// pnpm run update:deployments

import { Address } from 'viem';
import { writeFileSync, readFileSync } from 'node:fs';
import { ChainId, PERMIT2 } from '../src/utils/constants';
import {
    ContractRegistry,
    SupportedNetwork,
    SupportedNetworkResponse,
    AbiResponse,
    NetworkRegistryResponse,
} from './scripts.types';

// Create a map that looks like ['8453': '[ChainId.BASE]', '11155111': '[ChainId.SEPOLIA]']
const chainIdToHumanKey = Object.fromEntries(
    Object.entries(ChainId)
        .filter(([key]) => Number.isNaN(Number(key))) // Filter out numeric keys (enum values)
        .map(([key, value]) => [value, `[ChainId.${key}]`]),
);

// Update this list to add new Frontier V3 contracts
const targetContracts = [
    'Vault',
    'VaultAdmin',
    'VaultExtension',
    'Router',
    'BatchRouter',
    'CompositeLiquidityRouter',
    'BufferRouter',
    'WeightedPoolFactory',
    'StablePoolFactory',
    'GyroECLPPoolFactory',
];

const frontierContracts: ContractRegistry = {};
const permit2Updates: Record<string, Address> = {};

const deploymentsOrg = 'frontier-fi';
const deploymentsRepo = 'deployments';
const branch = 'main'; // point this at any frontier-fi/deployments branch
const deploymentsBase = `https://raw.githubusercontent.com/${deploymentsOrg}/${deploymentsRepo}/refs/heads/${branch}`;

async function updateFrontierDeployments() {
    const supportedNetworks = await fetchSupportedNetworks();
    await processContractData(supportedNetworks);
    updateContractAddresses();
    exportAbis();
}

async function fetchSupportedNetworks(): Promise<SupportedNetwork[]> {
    const res = await fetch(
        `${deploymentsBase}/addresses/.supported-networks.json`,
    );
    if (!res.ok) {
        throw new Error(
            `Failed to fetch supported networks: ${res.status} ${res.statusText}`,
        );
    }
    const data: Record<string, SupportedNetworkResponse> = await res.json();

    const supportedNetworks = Object.entries(data).map(
        ([name, { chainId }]) => ({
            networkName: name,
            chainId,
            deploymentsUrl: `${deploymentsBase}/addresses/${name}.json`,
        }),
    );

    supportedNetworks.sort((a, b) =>
        a.networkName.localeCompare(b.networkName),
    );

    return supportedNetworks;
}

async function processContractData(supportedNetworks: SupportedNetwork[]) {
    // Process each network sequentially to maintain consistent order
    for (const { networkName, chainId, deploymentsUrl } of supportedNetworks) {
        const chainKey = chainIdToHumanKey[chainId];
        if (!chainKey) {
            console.warn(
                `Skipping ${networkName} (chainId ${chainId}): no matching ChainId enum entry`,
            );
            continue;
        }

        const res = await fetch(deploymentsUrl);
        if (!res.ok) {
            throw new Error(`Failed to fetch network data for ${networkName}`);
        }

        const data: NetworkRegistryResponse = await res.json();

        // Process each task sequentially to maintain consistent order
        for (const [taskId, value] of Object.entries(data)) {
            if (value.status !== 'ACTIVE') continue;

            for (const contract of value.contracts) {
                if (!targetContracts.includes(contract.name)) continue;

                const { name } = contract;
                if (!frontierContracts[name]) frontierContracts[name] = {};
                frontierContracts[name][chainKey] = contract.address;

                // Grab contract ABIs using only sepolia
                if (networkName === 'sepolia') {
                    const url = `${deploymentsBase}/tasks/${taskId}/artifact/${contract.name}.json`;
                    const abiRes = await fetch(url);
                    if (!abiRes.ok) {
                        console.warn(
                            `Skipping ABI for ${contract.name}: ${abiRes.status} ${abiRes.statusText}`,
                        );
                        continue;
                    }
                    const abiData: AbiResponse = await abiRes.json();

                    const contractName =
                        contract.name.charAt(0).toLowerCase() +
                        contract.name.slice(1);
                    const content = `export const ${contractName}Abi_V3 = ${JSON.stringify(
                        abiData.abi,
                        undefined,
                        4,
                    )} as const;`;
                    const path = `./src/abi/v3/${contractName}.ts`;
                    writeFileSync(path, content);
                }
            }
        }

        // Update Permit2 entries when the deployments repo publishes them
        // https://github.com/frontier-fi/deployments/tree/main/tasks
        try {
            const permit2Url = `${deploymentsBase}/tasks/00000000-permit2/output/${networkName}.json`;
            const permit2Result = await fetch(permit2Url);
            if (!permit2Result.ok) {
                throw new Error(
                    `HTTP ${permit2Result.status} ${permit2Result.statusText}`,
                );
            }
            const permit2Data = await permit2Result.json();
            const permit2Address = permit2Data.Permit2;
            if (!permit2Address) {
                throw new Error(
                    `Failed to fetch Permit2 data for ${networkName}`,
                );
            }

            if (!PERMIT2[chainId]) {
                permit2Updates[chainKey] = permit2Address;
            }
        } catch (e) {
            // Frontier uses the canonical Permit2 addresses already configured in constants.ts
            console.log(`Failed to fetch Permit2 for ${networkName}: ${e}`);
        }
    }
}

function updateContractAddresses() {
    // Sort the contracts by name for easier PR reviews
    const sortedContracts = Object.fromEntries(
        Object.entries(frontierContracts).sort(([a], [b]) =>
            a.localeCompare(b),
        ),
    );

    const chainIdImport = `import { ChainId } from '@/utils/constants';\n\n`;

    const frontierContent =
        `${chainIdImport}export const frontierContracts = ${JSON.stringify(
            sortedContracts,
            undefined,
            4,
        )} as const;\n`.replace(/"(\[ChainId\.[A-Z_]+\])"/g, '$1');
    writeFileSync('./src/utils/frontierContracts.ts', frontierContent);

    // Update PERMIT2 addresses if there are new entries
    if (Object.keys(permit2Updates).length > 0) {
        const constantsPath = './src/utils/constants.ts';
        const constantsContent = readFileSync(constantsPath, 'utf-8');

        const permit2Regex =
            /(export const PERMIT2: Record<number, Address> = \{)([\s\S]*?)(\};)/;
        const permit2Match = constantsContent.match(permit2Regex);

        if (!permit2Match) {
            throw new Error('Could not find PERMIT2 object in constants file');
        }

        const existingContent = permit2Match[2];
        const existingPermit2: Record<string, Address> = {};

        const entryRegex = /(\[ChainId\.[A-Z_]+\]):\s*'([^']+)'/g;
        for (const match of existingContent.matchAll(entryRegex)) {
            existingPermit2[match[1]] = match[2] as Address;
        }

        const mergedPermit2 = { ...existingPermit2, ...permit2Updates };

        const sortedPermit2 = Object.fromEntries(
            Object.entries(mergedPermit2).sort(([a], [b]) =>
                a.localeCompare(b),
            ),
        );

        const permit2Entries = Object.entries(sortedPermit2)
            .map(([key, value]) => `    ${key}: '${value}',`)
            .join('\n');

        const updatedConstants = constantsContent.replace(
            permit2Regex,
            `$1\n${permit2Entries}\n$3`,
        );

        writeFileSync(constantsPath, updatedConstants);
    }
}

function exportAbis() {
    const staticHelperAbisV3 = ['weightedPool', 'stablePool', 'gyroECLP'];

    const exportAbisV3 = [...staticHelperAbisV3, ...targetContracts].map(
        (contract) =>
            `export * from './${
                contract[0].toLowerCase() + contract.slice(1)
            }';`,
    );
    writeFileSync('./src/abi/v3/index.ts', `${exportAbisV3.join('\n')}\n`);
}

updateFrontierDeployments();
