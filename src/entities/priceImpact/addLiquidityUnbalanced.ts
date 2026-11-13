import { abs, SDKError } from '@/utils';
import { SwapKind } from '@/types';

import { AddLiquidity } from '../addLiquidity';
import { AddLiquidityUnbalancedInput } from '../addLiquidity/types';
import { PriceImpactAmount } from '../priceImpactAmount';
import { RemoveLiquidity } from '../removeLiquidity';
import {
    RemoveLiquidityInput,
    RemoveLiquidityKind,
} from '../removeLiquidity/types';
import { Token } from '../token';
import { TokenAmount } from '../tokenAmount';
import { PoolState } from '../types';
import { priceImpactABA } from './helper';
import { Swap, SwapInput } from '../swap';

export const addLiquidityUnbalanced = async (
    input: AddLiquidityUnbalancedInput,
    poolState: PoolState,
): Promise<PriceImpactAmount> => {
    // inputs are being validated within AddLiquidity

    // simulate adding liquidity to get amounts in
    const addLiquidity = new AddLiquidity();
    let amountsIn: TokenAmount[];
    let bptOut: TokenAmount;
    let poolTokens: Token[];
    try {
        const queryResult = await addLiquidity.query(input, poolState);
        amountsIn = queryResult.amountsIn;
        bptOut = queryResult.bptOut;
        poolTokens = amountsIn.map((a) => a.token);
    } catch (err) {
        throw new SDKError(
            'Price Impact',
            'Add Liquidity Unbalanced',
            `addLiquidityUnbalanced operation will fail at SC level with user defined input.\n${err}`,
        );
    }

    // simulate removing liquidity to get amounts out
    const removeLiquidity = new RemoveLiquidity();
    const removeLiquidityInput: RemoveLiquidityInput = {
        chainId: input.chainId,
        rpcUrl: input.rpcUrl,
        sender: input.sender,
        userData: input.userData,
        bptIn: bptOut.toInputAmount(),
        kind: RemoveLiquidityKind.Proportional,
    };
    const { amountsOut } = await removeLiquidity.query(
        removeLiquidityInput,
        poolState,
    );

    // deltas between unbalanced and proportional amounts
    const deltas = amountsOut.map((a, i) => a.amount - amountsIn[i].amount);

    // zero out deltas by swapping between tokens from proportionalAmounts
    // to exactAmountsIn, leaving the remaining delta within a single token
    const remainingDeltaIndex = await reconcileDeltas(
        deltas,
        amountsIn,
        queryAddLiquidityForTokenDelta,
        querySwap,
    );
    if (remainingDeltaIndex === undefined) {
        return PriceImpactAmount.fromRawAmount(0n);
    }

    // get relevant amount for price impact calculation
    const deltaAmount = TokenAmount.fromRawAmount(
        amountsIn[remainingDeltaIndex].token,
        abs(deltas[remainingDeltaIndex]),
    );

    // calculate price impact using ABA method
    return priceImpactABA(
        amountsIn[remainingDeltaIndex],
        amountsIn[remainingDeltaIndex].sub(deltaAmount),
    );

    // helper functions

    async function querySwap(
        swapKind: SwapKind,
        tokenInIndex: number,
        tokenOutIndex: number,
        amount: bigint,
    ): Promise<bigint> {
        try {
            const swapInput: SwapInput = {
                chainId: input.chainId,
                userData: input.userData,
                paths: [
                    {
                        tokens: [
                            poolTokens[tokenInIndex].toInputToken(),
                            poolTokens[tokenOutIndex].toInputToken(),
                        ],
                        pools: [poolState.id],
                        inputAmountRaw:
                            swapKind === SwapKind.GivenIn ? amount : 0n,
                        outputAmountRaw:
                            swapKind === SwapKind.GivenOut ? amount : 0n,
                        protocolVersion: poolState.protocolVersion,
                    },
                ],
                swapKind,
            };
            const swap = new Swap(swapInput);
            const result = await swap.query(
                input.rpcUrl,
                undefined,
                input.sender,
            );
            return result.swapKind === SwapKind.GivenIn
                ? result.expectedAmountOut.amount
                : result.expectedAmountIn.amount;
        } catch {
            throw new SDKError(
                'Price Impact',
                'Add Liquidity Unbalanced',
                'Unexpected error while calculating addLiquidityUnbalanced PI at Swap step',
            );
        }
    }

    async function queryAddLiquidityForTokenDelta(
        tokenIndex: number,
    ): Promise<bigint> {
        const absDelta = TokenAmount.fromRawAmount(
            poolTokens[tokenIndex],
            abs(deltas[tokenIndex]),
        );
        try {
            const { bptOut: deltaBPT } = await addLiquidity.query(
                {
                    ...input,
                    amountsIn: [absDelta.toInputAmount()],
                },
                poolState,
            );
            return deltaBPT.amount;
        } catch {
            throw new SDKError(
                'Price Impact',
                'Add Liquidity Unbalanced',
                'Unexpected error while calculating addLiquidityUnbalanced PI at Delta add step',
            );
        }
    }
};

/** Internal reconciliation shared by regular and boosted ABA calculations. */
export async function reconcileDeltas(
    deltas: bigint[],
    amountsIn: TokenAmount[],
    queryDeltaBPT: (index: number) => Promise<bigint>,
    querySwap: (
        kind: SwapKind,
        tokenInIndex: number,
        tokenOutIndex: number,
        amount: bigint,
    ) => Promise<bigint>,
): Promise<number | undefined> {
    const deltaBPTs = new Map<number, bigint>();

    // Every swap clears at least one nonzero delta. Use raw balances to find
    // surpluses/deficits: a BPT quote can round to zero for a nonzero delta.
    for (let step = 0; step < deltas.length - 1; step++) {
        const positive = deltas.flatMap((d, i) => (d > 0n ? [i] : []));
        const negative = deltas.flatMap((d, i) => (d < 0n ? [i] : []));
        if (positive.length === 0 || negative.length === 0) break;

        // On the final pair, consume an undeposited surplus exactly so that
        // the residual stays on the deposited token. Exact-out can overspend
        // that surplus and require a second, fee-bearing reverse swap.
        const finalGivenIn =
            positive.length === 1 &&
            negative.length === 1 &&
            amountsIn[positive[0]].amount === 0n &&
            amountsIn[negative[0]].amount > 0n;
        let tokenInIndex = positive[0];
        let tokenOutIndex = negative[0];
        if (!finalGivenIn) {
            for (const index of [...positive, ...negative]) {
                if (!deltaBPTs.has(index)) {
                    deltaBPTs.set(index, await queryDeltaBPT(index));
                }
            }
            const smallest = (indices: number[]) =>
                indices.reduce((a, b) =>
                    deltaBPTs.get(a)! <= deltaBPTs.get(b)! ? a : b,
                );
            tokenInIndex = smallest(positive);
            tokenOutIndex = smallest(negative);
        }

        if (
            finalGivenIn ||
            deltaBPTs.get(tokenInIndex)! < deltaBPTs.get(tokenOutIndex)!
        ) {
            const amountOut = await querySwap(
                SwapKind.GivenIn,
                tokenInIndex,
                tokenOutIndex,
                deltas[tokenInIndex],
            );
            deltas[tokenInIndex] = 0n;
            deltas[tokenOutIndex] += amountOut;
        } else {
            const amountIn = await querySwap(
                SwapKind.GivenOut,
                tokenInIndex,
                tokenOutIndex,
                -deltas[tokenOutIndex],
            );
            deltas[tokenOutIndex] = 0n;
            deltas[tokenInIndex] -= amountIn;
        }
        deltaBPTs.delete(tokenInIndex);
        deltaBPTs.delete(tokenOutIndex);
    }

    const deficits = deltas.flatMap((d, i) => (d < 0n ? [i] : []));
    // No loss remains when cancellation is exact or only surpluses remain.
    // Proportional deposits may instead leave several small rounding deficits.
    if (deficits.length === 0) return undefined;

    // Quotes may exhaust the surpluses before all deficits are cleared. Value
    // every remaining deficit in one deposited token using exact-output swaps;
    // never discard a residual or divide by an initial amount of zero.
    // Avoid normalizing the total residual by a tiny deposited leg. scale18
    // compares nominal token amounts (not market values). Preserve an existing
    // deficit when largest deposits tie, avoiding an unnecessary conversion.
    const largestDeposit = amountsIn.reduce(
        (largest, amount) =>
            amount.scale18 > largest ? amount.scale18 : largest,
        0n,
    );
    const remainingIndex =
        deficits.find(
            (i) =>
                largestDeposit > 0n && amountsIn[i].scale18 === largestDeposit,
        ) ??
        amountsIn.findIndex(
            (a) => largestDeposit > 0n && a.scale18 === largestDeposit,
        );
    if (remainingIndex < 0) {
        throw new SDKError(
            'Price Impact',
            'Add Liquidity Unbalanced',
            'Cannot reconcile a deficit without a deposited token',
        );
    }
    for (const index of deficits) {
        if (index === remainingIndex) continue;
        const amountIn = await querySwap(
            SwapKind.GivenOut,
            remainingIndex,
            index,
            -deltas[index],
        );
        deltas[index] = 0n;
        deltas[remainingIndex] -= amountIn;
    }
    return remainingIndex;
}
