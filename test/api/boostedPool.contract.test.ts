import { describe, it, expect } from 'vitest';
import { FrontierApi } from '@/data/providers/frontier-api';
import { API_ENDPOINT, ChainId } from '@/utils';

const CHAIN_ID = ChainId.SEPOLIA;
const BOOSTED_POOL_ID = '0x8e06ef1a2e854feaee0a83510acd05f8e443fa4f';

describe('contract: boosted-pool-state (live API)', () => {
    const api = new FrontierApi(API_ENDPOINT, CHAIN_ID, {
        clientName: 'frontier-sdk-e2e-tests',
        clientVersion: '0.0.0',
    });

    it('fetches boosted pool with underlyings', async () => {
        const pool =
            await api.boostedPools.fetchPoolStateWithUnderlyings(
                BOOSTED_POOL_ID,
            );
        expect(pool.tokens.length).toBeGreaterThan(0);
        expect(pool.tokens.some((t) => t.underlyingToken !== null)).toBe(true);
    });
});
