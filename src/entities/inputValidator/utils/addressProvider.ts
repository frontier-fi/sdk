import { frontierContracts, SDKError } from '@/utils';
import { ChainId } from '@/utils/constants';
import { Hex, Address } from '@/types';

/**
 * Represents a mapping from ChainId to contract address.
 */
type ContractAddresses = Partial<Record<ChainId, Address>>;

/**
 * Utility class for retrieving Frontier contract addresses for a given chain.
 * Provides static methods for each contract type, with validation and error handling.
 */
export class AddressProvider {
    private static lookupContractName(contract: ContractAddresses): string {
        return (
            Object.entries(frontierContracts).find(
                ([, value]) => value === contract,
            )?.[0] || 'UnknownContract'
        );
    }

    private static getAddress(
        contract: ContractAddresses,
        chainId: ChainId,
    ): Hex {
        const address = contract[chainId];
        if (!address) {
            const contractName = AddressProvider.lookupContractName(contract);
            throw new SDKError(
                'AddressProvider',
                `get${contractName}`,
                `Address not found for ${contractName} on chainId: ${chainId}`,
            );
        }
        return address as Hex;
    }

    static BatchRouter(chainId: ChainId): Hex {
        return AddressProvider.getAddress(
            frontierContracts.BatchRouter,
            chainId,
        );
    }
    static BufferRouter(chainId: ChainId): Hex {
        return AddressProvider.getAddress(
            frontierContracts.BufferRouter,
            chainId,
        );
    }
    static CompositeLiquidityRouter(chainId: ChainId): Hex {
        return AddressProvider.getAddress(
            frontierContracts.CompositeLiquidityRouter,
            chainId,
        );
    }
    static GyroECLPPoolFactory(chainId: ChainId): Hex {
        return AddressProvider.getAddress(
            frontierContracts.GyroECLPPoolFactory,
            chainId,
        );
    }
    static Router(chainId: ChainId): Hex {
        return AddressProvider.getAddress(frontierContracts.Router, chainId);
    }
    static StablePoolFactory(chainId: ChainId): Hex {
        return AddressProvider.getAddress(
            frontierContracts.StablePoolFactory,
            chainId,
        );
    }
    static Vault(chainId: ChainId): Hex {
        return AddressProvider.getAddress(frontierContracts.Vault, chainId);
    }
    static VaultAdmin(chainId: ChainId): Hex {
        return AddressProvider.getAddress(
            frontierContracts.VaultAdmin,
            chainId,
        );
    }
    static VaultExtension(chainId: ChainId): Hex {
        return AddressProvider.getAddress(
            frontierContracts.VaultExtension,
            chainId,
        );
    }
    static WeightedPoolFactory(chainId: ChainId): Hex {
        return AddressProvider.getAddress(
            frontierContracts.WeightedPoolFactory,
            chainId,
        );
    }
}
