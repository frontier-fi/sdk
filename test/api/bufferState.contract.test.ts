import { describe, it, expect } from 'vitest';
import { FrontierApi } from '@/data/providers/frontier-api';
import { API_ENDPOINT, ChainId } from '@/utils';

const CHAIN_ID = ChainId.SEPOLIA;
const WRAPPED_ERC4626 = '0x8a88124522dbbf1e56352ba3de1d9f78c143751e';

describe('contract: buffer-state (live API)', () => {
    const api = new FrontierApi(API_ENDPOINT, CHAIN_ID, {
        clientName: 'frontier-sdk-e2e-tests',
        clientVersion: '0.0.0',
    });

    it('fetches buffer state for ERC4626 token', async () => {
        const state = await api.buffers.fetchBufferState(WRAPPED_ERC4626);
        expect(state.wrappedToken.address).toBeDefined();
        expect(state.underlyingToken.address).toBeDefined();
    });
});
