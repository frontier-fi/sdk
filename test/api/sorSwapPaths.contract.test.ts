import { describe, it, expect } from 'vitest';
import { FrontierApi } from '@/data/providers/frontier-api';
import { API_ENDPOINT, ChainId } from '@/utils';
import { Address } from 'viem';
import { Token, TokenAmount } from '@/entities';
import { SwapKind } from '@/types';

const CHAIN_ID = ChainId.SEPOLIA;
const TOKEN_IN = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14' as Address; // Sepolia WETH
const TOKEN_OUT = '0x80d6d3946ed8a1da4e226aa21ccddc32bd127d1a' as Address; // Sepolia USDC

describe('contract: sor swap paths (live API)', () => {
    const api = new FrontierApi(API_ENDPOINT, CHAIN_ID, {
        clientName: 'frontier-sdk-e2e-tests',
        clientVersion: '0.0.0',
    });

    it('fetches SOR swap paths', async () => {
        const token = new Token(CHAIN_ID, TOKEN_IN, 18);
        const oneUnit = TokenAmount.fromHumanAmount(token, '0.001');
        const paths = await api.sorSwapPaths.fetchSorSwapPaths({
            chainId: CHAIN_ID,
            tokenIn: TOKEN_IN,
            tokenOut: TOKEN_OUT,
            swapKind: SwapKind.GivenIn,
            swapAmount: oneUnit,
        });
        expect(Array.isArray(paths)).toBe(true);
    });

    it('fetches SOR swap paths with protocol version', async () => {
        const token = new Token(CHAIN_ID, TOKEN_IN, 18);
        const oneUnit = TokenAmount.fromHumanAmount(token, '0.001');
        const paths = await api.sorSwapPaths.fetchSorSwapPaths({
            chainId: CHAIN_ID,
            tokenIn: TOKEN_IN,
            tokenOut: TOKEN_OUT,
            swapKind: SwapKind.GivenIn,
            swapAmount: oneUnit,
            useProtocolVersion: 3,
        });
        expect(Array.isArray(paths)).toBe(true);
    });
});
