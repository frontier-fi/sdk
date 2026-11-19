import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ChainId } from '@/utils/constants';
import { CHAIN_RPC, resolveRpcUrl } from './rpc';

describe('resolveRpcUrl', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        delete process.env.ETHEREUM_RPC_URL;
        delete process.env.DRPC_API_KEY;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    test('prefers chain-specific *_RPC_URL over DRPC_API_KEY and fallback', () => {
        process.env.ETHEREUM_RPC_URL = 'https://custom-eth.example';
        process.env.DRPC_API_KEY = 'secret-drpc-key';

        expect(resolveRpcUrl(CHAIN_RPC[ChainId.MAINNET])).toEqual({
            url: 'https://custom-eth.example',
            source: 'env',
        });
    });

    test('uses dRPC when DRPC_API_KEY is set and no chain override is provided', () => {
        process.env.DRPC_API_KEY = 'secret-drpc-key';

        expect(resolveRpcUrl(CHAIN_RPC[ChainId.MAINNET])).toEqual({
            url: 'https://lb.drpc.live/ethereum/secret-drpc-key',
            source: 'drpc',
        });
    });

    test('ignores literal "undefined" strings and falls back to public RPC', () => {
        process.env.ETHEREUM_RPC_URL = 'undefined';
        process.env.DRPC_API_KEY = 'undefined';

        expect(resolveRpcUrl(CHAIN_RPC[ChainId.MAINNET])).toEqual({
            url: CHAIN_RPC[ChainId.MAINNET].fallBackRpc,
            source: 'fallback',
        });
    });
});
