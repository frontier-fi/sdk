import { ChainId } from '@/utils/constants';

export type ChainRpcConfig = {
    rpcEnv: string;
    drpcNetwork?: string;
    fallBackRpc: string | undefined;
};

export const CHAIN_RPC: Record<ChainId, ChainRpcConfig> = {
    [ChainId.MAINNET]: {
        rpcEnv: 'ETHEREUM_RPC_URL',
        drpcNetwork: 'ethereum',
        fallBackRpc: 'https://mainnet.gateway.tenderly.co',
    },
    [ChainId.MONAD]: {
        rpcEnv: 'MONAD_RPC_URL',
        drpcNetwork: 'monad',
        fallBackRpc: 'https://monad.gateway.tenderly.co',
    },
    [ChainId.BASE]: {
        rpcEnv: 'BASE_RPC_URL',
        drpcNetwork: 'base',
        fallBackRpc: 'https://base.gateway.tenderly.co',
    },
    [ChainId.SEPOLIA]: {
        rpcEnv: 'SEPOLIA_RPC_URL',
        drpcNetwork: 'sepolia',
        fallBackRpc: 'https://sepolia.gateway.tenderly.co',
    },
};

function getEnvValue(name: string): string | undefined {
    const value = process.env[name];
    // sometimes .env will return 'undefined' as string for undefined variables
    if (!value || value === 'undefined') return undefined;
    return value;
}

export function resolveRpcUrl(rpcConfig: ChainRpcConfig): {
    url: string;
    source: 'env' | 'drpc' | 'fallback';
} {
    const envUrl = getEnvValue(rpcConfig.rpcEnv);
    if (envUrl) return { url: envUrl, source: 'env' };

    const drpcApiKey = getEnvValue('DRPC_API_KEY');
    if (drpcApiKey && rpcConfig.drpcNetwork) {
        return {
            url: `https://lb.drpc.live/${rpcConfig.drpcNetwork}/${drpcApiKey}`,
            source: 'drpc',
        };
    }

    if (!rpcConfig.fallBackRpc) {
        throw Error(
            `Please set ${rpcConfig.rpcEnv} or DRPC_API_KEY in your environment`,
        );
    }

    return { url: rpcConfig.fallBackRpc, source: 'fallback' };
}
