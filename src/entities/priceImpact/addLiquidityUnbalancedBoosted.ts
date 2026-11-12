import { abs, ChainId, isSameAddress, SDKError } from '../../utils';
import { InputToken, SwapKind } from '../../types';
import { PriceImpactAmount } from '../priceImpactAmount';
import { RemoveLiquidityKind } from '../removeLiquidity/types';
import { Swap, SwapInput, TokenApi } from '../swap';
import { TokenAmount } from '../tokenAmount';
import { PoolStateWithUnderlyings, PoolTokenWithUnderlying } from '../types';
import { priceImpactABA } from './helper';
import { AddLiquidityBoostedUnbalancedInput } from '../addLiquidityBoosted/types';
import { AddLiquidityBoostedV3 } from '../addLiquidityBoosted';
import { RemoveLiquidityBoostedV3 } from '../removeLiquidityBoosted';
import { RemoveLiquidityBoostedProportionalInput } from '../removeLiquidityBoosted/types';
import { Address } from 'viem';
import { Token } from '../token';
import { reconcileDeltas } from './addLiquidityUnbalanced';

/**
 * Calculate price impact on add liquidity unbalanced operations
 *
 * This is the only price impact calculation that adapts the ABA method instead
 * of applying it directly. This happens because tha ABA method requires a
 * corresponding reverse operation to be applied, so we "get back" to the original
 * state for comparison, hence A -> B -> A.
 * This is not possible for AddLiquidityUnbalanced on v3 because there is no
 * RemoveLiquidityUnbalanced.
 * The alternative found was to simulate the RemoveLiquidityUnbalanced by applying
 * RemoveLiquidityProportional and then swapping between tokens.
 *
 * Here are the steps to calculate the price impact for add liquidity unbalanced:
 * 1. query add liquidity unbalanced with `exactAmountsIn` to get `bptOut`
 * 2. query remove liquidity proportional with `bptOut` as `bptIn` to get `proportionalAmountsOut`
 * 3. get `diffs` =  `proportionalAmountsOut` - `exactAmountsIn`
 * 4. swap between tokens zeroing out the `diffs` between `proportionalAmountsOut`
 *    and `exactAmountsIn`, leaving the remaining diff within a single
 *    token → `diffFinal` (see code below for detailed steps)
 * 5. `amountInitial` will be the the `exactAmountsIn` respective to `diffFinal` token
 * 6. price impact ABA = `diffFinal` / `amountInitial` / 2
 *
 * @param input same input used in the corresponding add liquidity operation
 * @param poolState same pool state used in the corresponding add liquidity operation
 * @returns price impact amount
 */
export async function addLiquidityUnbalancedBoosted(
    input: AddLiquidityBoostedUnbalancedInput,
    poolState: PoolStateWithUnderlyings,
): Promise<PriceImpactAmount> {
    // inputs are being validated within AddLiquidity

    // simulate adding liquidity to get amounts in
    const addLiquidity = new AddLiquidityBoostedV3();
    let amountsIn: TokenAmount[];
    let bptOut: TokenAmount;
    try {
        const queryResult = await addLiquidity.query(input, poolState);
        amountsIn = queryResult.amountsIn;
        bptOut = queryResult.bptOut;
    } catch (err) {
        throw new SDKError(
            'Price Impact',
            'Add Liquidity Boosted Unbalanced',
            `addLiquidity operation will fail at SC level with user defined input.\n${err}`,
        );
    }
    const poolTokens = amountsIn.map((a) => a.token);

    // simulate removing liquidity to get amounts out
    const removeLiquidity = new RemoveLiquidityBoostedV3();
    const removeLiquidityInput: RemoveLiquidityBoostedProportionalInput = {
        chainId: input.chainId,
        rpcUrl: input.rpcUrl,
        sender: input.sender,
        userData: input.userData,
        bptIn: bptOut.toInputAmount(),
        tokensOut: poolTokens.map((t) => t.address),
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
        (index) =>
            queryAddLiquidityForTokenDelta(
                addLiquidity,
                input,
                poolState,
                poolTokens,
                index,
                deltas[index],
            ),
        async (swapKind, tokenInIndex, tokenOutIndex, amount) => {
            const swapInput = buildSwapInput(
                input.chainId,
                swapKind,
                poolState.address,
                getTokenWrapInfo(
                    poolState.tokens,
                    poolTokens[tokenInIndex].toInputToken(),
                ),
                getTokenWrapInfo(
                    poolState.tokens,
                    poolTokens[tokenOutIndex].toInputToken(),
                ),
                swapKind === SwapKind.GivenIn ? amount : 0n,
                swapKind === SwapKind.GivenOut ? amount : 0n,
            );
            try {
                const swap = new Swap({
                    ...swapInput,
                    userData: input.userData,
                });
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
                    'Add Liquidity Boosted Unbalanced',
                    'Unexpected error while calculating addLiquidityBoostedUnbalanced PI at Swap step',
                );
            }
        },
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
}

async function queryAddLiquidityForTokenDelta(
    addLiquidity: AddLiquidityBoostedV3,
    input: AddLiquidityBoostedUnbalancedInput,
    poolState: PoolStateWithUnderlyings,
    poolTokens: Token[],
    tokenIndex: number,
    delta: bigint,
): Promise<bigint> {
    const absDelta = TokenAmount.fromRawAmount(
        poolTokens[tokenIndex],
        abs(delta),
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
    } catch (err) {
        throw new SDKError(
            'Price Impact',
            'Add Liquidity Boosted Unbalanced',
            `Unexpected error while calculating addLiquidityBoostedUnbalanced PI at Delta add step:\n${err}`,
        );
    }
}

type TokenWrapInfo = {
    token: InputToken;
    shouldWrap: boolean;
    wrapped: InputToken | undefined;
};

function getTokenWrapInfo(
    tokens: PoolTokenWithUnderlying[],
    token: InputToken,
): TokenWrapInfo {
    const poolToken = tokens.find((t) =>
        isSameAddress(t.address, token.address),
    );
    if (poolToken)
        return {
            token: poolToken,
            shouldWrap: false,
            wrapped: undefined,
        };

    const wrapped = tokens
        .filter((t) => t.underlyingToken !== null)
        .find((t) => isSameAddress(t.underlyingToken!.address, token.address));

    if (!wrapped)
        throw new SDKError(
            'Price Impact',
            'Add Liquidity Boosted Unbalanced',
            `Cannot map underlying token to wrapped: ${token.address}`,
        );
    return {
        token: token,
        shouldWrap: true,
        wrapped,
    };
}

function buildSwapInput(
    chainId: ChainId,
    swapKind: SwapKind,
    pool: Address,
    tokenInWrapInfo: TokenWrapInfo,
    tokenOutWrapInfo: TokenWrapInfo,
    inputAmountRaw: bigint,
    outputAmountRaw: bigint,
): SwapInput {
    const inTokens: TokenApi[] = [
        {
            address: tokenInWrapInfo.token.address,
            decimals: tokenInWrapInfo.token.decimals,
        },
    ];

    const outTokens = [
        {
            address: tokenOutWrapInfo.token.address,
            decimals: tokenOutWrapInfo.token.decimals,
        },
    ];

    const pools = [pool];
    const isBuffer = [false];

    if (tokenInWrapInfo.shouldWrap) {
        inTokens.push({
            address: tokenInWrapInfo.wrapped!.address,
            decimals: tokenInWrapInfo.wrapped!.decimals,
        });
        pools.unshift(tokenInWrapInfo.wrapped!.address);
        isBuffer.unshift(true);
    }

    if (tokenOutWrapInfo.shouldWrap) {
        outTokens.unshift({
            address: tokenOutWrapInfo.wrapped!.address,
            decimals: tokenOutWrapInfo.wrapped!.decimals,
        });
        pools.push(tokenOutWrapInfo.wrapped!.address);
        isBuffer.push(true);
    }

    // Construct a buffer swap
    const swapInput: SwapInput = {
        chainId,
        paths: [
            {
                tokens: [...inTokens, ...outTokens],
                pools,
                isBuffer,
                inputAmountRaw,
                outputAmountRaw,
                protocolVersion: 3,
            },
        ],
        swapKind,
    };
    return swapInput;
}
