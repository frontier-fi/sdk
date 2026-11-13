// pnpm test -- priceImpact/priceImpactErrors.V3.integration.test.ts

import dotenv from 'dotenv';
dotenv.config();

import { Address } from 'viem';
import {
    AddLiquidityBoostedUnbalancedInput,
    AddLiquidityKind,
    ChainId,
    PriceImpact,
    RemoveLiquidityKind,
    RemoveLiquiditySingleTokenExactInInput,
} from 'src';

import { ANVIL_NETWORKS, startFork } from 'test/anvil/anvil-global-setup';
import { TOKENS } from 'test/lib/utils/addresses';
import { boostedPool_WBTC_AAVE } from 'test/mockData/boostedPool';
import { weightedWethUsdc, WETH } from 'test/mockData/weightedWethBalPool';

const chainId = ChainId.SEPOLIA;
const WBTC = TOKENS[chainId].WBTC;

describe('PriceImpact Errors V3', () => {
    let rpcUrl: string;
    beforeAll(async () => {
        ({ rpcUrl } = await startFork(ANVIL_NETWORKS.SEPOLIA));
    });

    test('Expect Error for failing add input', async () => {
        const addLiquidityInput: AddLiquidityBoostedUnbalancedInput = {
            chainId,
            rpcUrl,
            amountsIn: [
                {
                    rawAmount: 10000000000000000n,
                    decimals: WBTC.decimals,
                    address: WBTC.address as Address,
                },
            ],
            kind: AddLiquidityKind.Unbalanced,
            userData: '0x',
        };

        await expect(() =>
            PriceImpact.addLiquidityUnbalancedBoosted(
                addLiquidityInput,
                boostedPool_WBTC_AAVE,
            ),
        ).rejects.toThrowError(
            'operation will fail at SC level with user defined input.',
        );
    });

    test('Expect Error for failing remove input', async () => {
        const removeLiquidityInput: RemoveLiquiditySingleTokenExactInInput = {
            chainId,
            rpcUrl,
            bptIn: {
                rawAmount: 1000000000000000000000n,
                decimals: 18,
                address: weightedWethUsdc.address,
            },
            tokenOut: WETH.address,
            kind: RemoveLiquidityKind.SingleTokenExactIn,
        };

        await expect(() =>
            PriceImpact.removeLiquidity(removeLiquidityInput, weightedWethUsdc),
        ).rejects.toThrowError(
            'removeLiquidity operation will fail at SC level with user defined input',
        );
    });
});
