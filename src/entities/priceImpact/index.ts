import { AddLiquidity } from '../addLiquidity';
import {
    AddLiquidityKind,
    AddLiquiditySingleTokenInput,
    AddLiquidityUnbalancedInput,
} from '../addLiquidity/types';
import { PriceImpactAmount } from '../priceImpactAmount';
import { RemoveLiquidity } from '../removeLiquidity';
import {
    RemoveLiquidityInput,
    RemoveLiquidityKind,
    RemoveLiquiditySingleTokenExactInInput,
} from '../removeLiquidity/types';
import { TokenAmount } from '../tokenAmount';
import { PoolState, PoolStateWithUnderlyings } from '../types';
import { getSortedTokens } from '../utils';
import { AddLiquidityBoostedUnbalancedInput } from '../addLiquidityBoosted/types';
import { addLiquidityUnbalancedBoosted } from './addLiquidityUnbalancedBoosted';
import { priceImpactABA } from './helper';
import { addLiquidityUnbalanced } from './addLiquidityUnbalanced';
import { SDKError } from '@/utils/errors';

export * from './helper';

export class PriceImpact {
    static addLiquiditySingleToken = async (
        input: AddLiquiditySingleTokenInput,
        poolState: PoolState,
    ): Promise<PriceImpactAmount> => {
        const addLiquidity = new AddLiquidity();
        let amountsIn: TokenAmount[];
        try {
            const queryResult = await addLiquidity.query(input, poolState);
            amountsIn = queryResult.amountsIn;
        } catch (err) {
            throw new SDKError(
                'Price Impact',
                'Add Liquidity Single Token',
                `addLiquiditySingleToken operation will fail at SC level with user defined input.\n${err}`,
            );
        }

        const removeLiquidity = new RemoveLiquidity();
        const removeLiquidityInput: RemoveLiquidityInput = {
            chainId: input.chainId,
            rpcUrl: input.rpcUrl,
            bptIn: input.bptOut,
            tokenOut: input.tokenIn,
            kind: RemoveLiquidityKind.SingleTokenExactIn,
        };
        const { amountsOut } = await removeLiquidity.query(
            removeLiquidityInput,
            poolState,
        );

        const sortedTokens = getSortedTokens(poolState.tokens, input.chainId);
        const tokenIndex = sortedTokens.findIndex((t) =>
            t.isSameAddress(input.tokenIn),
        );

        return priceImpactABA(amountsIn[tokenIndex], amountsOut[tokenIndex]);
    };

    static addLiquidityUnbalanced = async (
        input: AddLiquidityUnbalancedInput,
        poolState: PoolState,
    ): Promise<PriceImpactAmount> => {
        return addLiquidityUnbalanced(input, poolState);
    };

    static async addLiquidityUnbalancedBoosted(
        input: AddLiquidityBoostedUnbalancedInput,
        poolState: PoolStateWithUnderlyings,
    ): Promise<PriceImpactAmount> {
        return addLiquidityUnbalancedBoosted(input, poolState);
    }

    static removeLiquidity = async (
        input: RemoveLiquiditySingleTokenExactInInput,
        poolState: PoolState,
    ): Promise<PriceImpactAmount> => {
        const removeLiquidity = new RemoveLiquidity();
        let amountsOut: TokenAmount[];
        let bptIn: TokenAmount;
        try {
            const queryResult = await removeLiquidity.query(input, poolState);
            amountsOut = queryResult.amountsOut;
            bptIn = queryResult.bptIn;
        } catch (err) {
            throw new SDKError(
                'Price Impact',
                'Remove Liquidity',
                `removeLiquidity operation will fail at SC level with user defined input.\n${err}`,
            );
        }

        const addLiquidity = new AddLiquidity();
        const addLiquidityInput: AddLiquidityUnbalancedInput = {
            chainId: input.chainId,
            rpcUrl: input.rpcUrl,
            amountsIn: amountsOut.map((a) => a.toInputAmount()),
            kind: AddLiquidityKind.Unbalanced,
        };
        const { bptOut } = await addLiquidity.query(
            addLiquidityInput,
            poolState,
        );

        return priceImpactABA(bptIn, bptOut);
    };
}
