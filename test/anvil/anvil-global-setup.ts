import dotenv from 'dotenv';
dotenv.config();

import { Anvil, CreateAnvilOptions, createAnvil } from '@viem/anvil';
import { ChainId } from '../../src/utils/constants';
import { sleep } from '../lib/utils/promises';

export type NetworkSetup = {
    rpcEnv: string;
    fallBackRpc: string | undefined;
    port: number;
    forkBlockNumber: bigint;
};

type NetworksWithFork = Extract<keyof typeof ChainId, 'SEPOLIA' | 'BASE'>;

const ANVIL_PORTS: Record<NetworksWithFork, number> = {
    // Ports separated by 100 to avoid port collision when running tests in parallel
    SEPOLIA: 8945,
    BASE: 9045,
};

export const ANVIL_NETWORKS: Record<NetworksWithFork, NetworkSetup> = {
    SEPOLIA: {
        rpcEnv: 'SEPOLIA_RPC_URL',
        fallBackRpc: 'https://sepolia.gateway.tenderly.co',
        port: ANVIL_PORTS.SEPOLIA,
        forkBlockNumber: 12127500n,
    },
    BASE: {
        rpcEnv: 'BASE_RPC_URL',
        fallBackRpc: 'https://mainnet.base.org',
        port: ANVIL_PORTS.BASE,
        forkBlockNumber: 42000000n,
    },
};

function getAnvilOptions(
    network: NetworkSetup,
    blockNumber?: bigint,
): CreateAnvilOptions {
    let forkUrl: string;
    if (
        process.env[network.rpcEnv] &&
        process.env[network.rpcEnv] !== 'undefined' // sometimes .env will return 'undefined' as string for undefined variables
    ) {
        forkUrl = process.env[network.rpcEnv] as string;
    } else {
        if (!network.fallBackRpc)
            throw Error(
                `Please add a environment variable for: ${network.rpcEnv}`,
            );
        forkUrl = network.fallBackRpc;
        console.warn(
            `\`${network.rpcEnv}\` not found. Falling back to \`${forkUrl}\`.`,
        );
    }
    const port = network.port;
    const forkBlockNumber = blockNumber ?? network.forkBlockNumber;
    return {
        forkUrl,
        port,
        forkBlockNumber,
        mnemonic:
            'you twelve word test phrase boat cat like this example dog car', // mnemonic for deterministic accounts - should not have delegated accounts
    };
}

// Counter to ensure unique ports for each fork instance
let forkCounter = 0;

// Controls the current running forks to avoid starting the same fork twice
let runningForks: Record<number, Anvil> = {};

// Make sure that forks are stopped after each test suite
export async function stopAnvilForks() {
    await Promise.all(
        Object.values(runningForks).map(async (anvil) => {
            // console.log('Stopping anvil fork', anvil.options);
            return anvil.stop();
        }),
    );
    runningForks = {};
    // Reset fork counter after stopping all forks to prevent unbounded growth
    forkCounter = 0;
}

// Stop a specific anvil fork
// Note: Since forks are no longer reused (each startFork() creates a new instance),
// this function may not reliably find forks without tracking the exact port.
// For cleanup, prefer using stopAnvilForks() which stops all forks.
export async function stopAnvilFork(
    network: NetworkSetup,
    jobId = Number(process.env.VITEST_WORKER_ID) || 0,
    blockNumber?: bigint, // If not provided, the fork will start from the network's forkBlockNumber
) {
    const anvilOptions = getAnvilOptions(network, blockNumber);

    const defaultAnvilPort = 8545;
    // Note: This port calculation doesn't account for forkCounter, so it may not find the fork
    // if it was created with a counter offset. This function is kept for compatibility but
    // stopAnvilForks() is recommended for cleanup.
    const port = (anvilOptions.port || defaultAnvilPort) + jobId;
    if (!runningForks[port]) return;

    await runningForks[port].stop();
    delete runningForks[port];
}

/*
    Starts an anvil fork with the given options.
    In vitest, each thread is assigned a unique, numerical id (`process.env.VITEST_POOL_ID`).
    When jobId is provided, the fork uses this id to create a different local rpc url (e.g. `http://127.0.0.1:<8545+jobId>/`
    so that tests can be run in parallel (depending on the number of threads of the host machine)
    
    IMPORTANT: Each call to startFork() creates a new fork instance with a unique port.
    This ensures complete isolation between test suites, preventing state interference and snapshot collisions.
*/
export async function startFork(
    network: NetworkSetup,
    jobId = Number(process.env.VITEST_WORKER_ID) || 0,
    blockNumber?: bigint, // If not provided, the fork will start from the network's forkBlockNumber
    blockTime?: number,
    startTimeout?: number, // Timeout in milliseconds for starting anvil (default: 60 seconds)
) {
    const anvilOptions = getAnvilOptions(network, blockNumber);

    const defaultAnvilPort = 8545;
    const basePort = anvilOptions.port || defaultAnvilPort;
    // Calculate unique port: basePort + jobId + (forkCounter * 100)
    // This ensures each fork gets a unique port while maintaining network separation
    const port = basePort + jobId + forkCounter * 100;
    forkCounter++;

    if (!anvilOptions.forkUrl) {
        throw Error(
            'Anvil forkUrl must have a value. Please review your anvil setup',
        );
    }
    const rpcUrl = `http://127.0.0.1:${port}`;

    console.log('Starting new fork', {
        port,
        forkBlockNumber: blockNumber ?? anvilOptions.forkBlockNumber,
        runningForks: Object.keys(runningForks).length,
    });

    // https://www.npmjs.com/package/@viem/anvil
    // Pass startTimeout directly to createAnvil - it defaults to 10_000ms
    const timeout = startTimeout ?? 60_000; // Default to 60 seconds
    const anvil = createAnvil({
        ...anvilOptions,
        port,
        blockTime,
        startTimeout: timeout,
    });
    // Save reference to running fork
    runningForks[port] = anvil;

    if (process.env.SKIP_GLOBAL_SETUP === 'true') {
        console.warn(`🛠️  Skipping global anvil setup. You must run the anvil fork manually. Example:
anvil --fork-url https://eth-mainnet.alchemyapi.io/v2/<your-key> --port 8545 --fork-block-number=17878719
`);
        await sleep(5000);
        return { rpcUrl };
    }
    console.log('🛠️  Starting anvil', {
        port,
        forkBlockNumber: blockNumber ?? anvilOptions.forkBlockNumber,
        startTimeout: timeout,
    });

    await anvil.start();

    return {
        rpcUrl,
    };
}
