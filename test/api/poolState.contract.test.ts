import { describe, it, expect } from 'vitest';
import { FrontierApi } from '@/data/providers/frontier-api';
import { API_ENDPOINT, ChainId } from '@/utils';

const CHAIN_ID = ChainId.SEPOLIA;
const POOL_ID = '0xca9f6d682162cca9e0bf3c96de649e372099d89d';

describe('contract: pool-state (live API)', () => {
    const api = new FrontierApi(API_ENDPOINT, CHAIN_ID, {
        clientName: 'frontier-sdk-e2e-tests',
        clientVersion: '0.0.0',
    });

    it('fetches pool state', async () => {
        const pool = await api.pools.fetchPoolState(POOL_ID);
        expect(pool.id).toBeDefined();
        expect(pool.address).toBeDefined();
        expect(pool.tokens.length).toBeGreaterThan(0);
    });

    it('fetches pool state with balances', async () => {
        const pool = await api.pools.fetchPoolStateWithBalances(POOL_ID);
        expect(pool.totalShares).toBeDefined();
        expect(pool.tokens.length).toBeGreaterThan(0);
        expect(pool.tokens[0].balance).toBeDefined();
    });
});
