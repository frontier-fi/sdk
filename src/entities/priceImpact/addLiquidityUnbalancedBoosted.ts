import { Address } from 'viem';
import { InputToken, SwapKind } from '../../types';
import { ChainId, SDKError, abs, isSameAddress } from '../../utils';
import { AddLiquidity } from '../addLiquidity';
import { AddLiquidityBoostedV3 } from '../addLiquidityBoosted';
import { AddLiquidityBoostedUnbalancedInput } from '../addLiquidityBoosted/types';
import { PriceImpactAmount } from '../priceImpactAmount';
import { RemoveLiquidityKind } from '../removeLiquidity/types';
import { RemoveLiquidityBoostedV3 } from '../removeLiquidityBoosted';
import { RemoveLiquidityBoostedProportionalInput } from '../removeLiquidityBoosted/types';
import { Swap, SwapInput, TokenApi } from '../swap';
import { Token } from '../token';
import { TokenAmount } from '../tokenAmount';
import {
    PoolState,
    PoolStateWithUnderlyings,
    PoolTokenWithUnderlying,
} from '../types';
import {
    createDustBudget,
    isSubMinimumAmountRevert,
    isWrapSubMinimumRevert,
    reconcileDeltas,
} from './addLiquidityUnbalanced';
import { previewErc4626 } from './erc4626Preview';
import { priceImpactABA } from './helper';

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
    const dustBudget = createDustBudget(amountsIn, amountsOut);
    const wrappedPoolState: PoolState = {
        ...poolState,
        tokens: poolState.tokens.map(({ index, address, decimals }) => ({
            index,
            address,
            decimals,
        })),
    };

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
                wrappedPoolState,
                poolTokens,
                index,
                deltas[index],
                dustBudget,
            ),
        async (swapKind, tokenInIndex, tokenOutIndex, amount) => {
            const tokenInWrapInfo = getTokenWrapInfo(
                poolState.tokens,
                tokenInIndex,
                poolTokens[tokenInIndex].toInputToken(),
            );
            const tokenOutWrapInfo = getTokenWrapInfo(
                poolState.tokens,
                tokenOutIndex,
                poolTokens[tokenOutIndex].toInputToken(),
            );
            const swapInput = buildSwapInput(
                input.chainId,
                swapKind,
                poolState.address,
                tokenInWrapInfo,
                tokenOutWrapInfo,
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
            } catch (err) {
                if (isSubMinimumAmountRevert(err)) {
                    const givenIndex =
                        swapKind === SwapKind.GivenIn
                            ? tokenInIndex
                            : tokenOutIndex;
                    if (dustBudget.tryConsume(givenIndex, amount)) return null;

                    if (
                        isWrapSubMinimumRevert(err) &&
                        (tokenInWrapInfo.shouldWrap ||
                            tokenOutWrapInfo.shouldWrap)
                    ) {
                        try {
                            return await queryPoolDirectSwap(
                                input,
                                wrappedPoolState,
                                swapKind,
                                tokenInWrapInfo,
                                tokenOutWrapInfo,
                                amount,
                            );
                        } catch {
                            // Preserve the existing Swap step error contract.
                        }
                    }
                }
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
    wrappedPoolState: PoolState,
    poolTokens: Token[],
    tokenIndex: number,
    delta: bigint,
    dustBudget: ReturnType<typeof createDustBudget>,
): Promise<bigint | null> {
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
        let reportedError = err;
        if (isSubMinimumAmountRevert(err)) {
            if (dustBudget.tryConsume(tokenIndex, absDelta.amount)) return null;

            const wrapInfo = getTokenWrapInfo(
                poolState.tokens,
                tokenIndex,
                poolTokens[tokenIndex].toInputToken(),
            );
            if (isWrapSubMinimumRevert(err) && wrapInfo.shouldWrap) {
                try {
                    const wrapped = wrapInfo.wrapped!;
                    const shares = await previewErc4626(
                        input.rpcUrl,
                        input.chainId,
                        wrapped.address,
                        'previewDeposit',
                        absDelta.amount,
                    );
                    if (shares === 0n) {
                        throw new Error('ERC4626 preview returned zero shares');
                    }
                    const { bptOut } = await new AddLiquidity().query(
                        {
                            ...input,
                            amountsIn: [
                                {
                                    address: wrapped.address,
                                    decimals: wrapped.decimals,
                                    rawAmount: shares,
                                },
                            ],
                        },
                        wrappedPoolState,
                    );
                    return bptOut.amount;
                } catch (fallbackError) {
                    reportedError = fallbackError;
                }
            }
        }
        throw new SDKError(
            'Price Impact',
            'Add Liquidity Boosted Unbalanced',
            `Unexpected error while calculating addLiquidityBoostedUnbalanced PI at Delta add step:\n${reportedError}`,
        );
    }
}

/**
 * Estimate a pool quote when a material leg cannot pass the buffer floor.
 * The direct router and ERC4626 previews can differ from buffer rounding and
 * from router-sensitive hooks.
 */
async function queryPoolDirectSwap(
    input: AddLiquidityBoostedUnbalancedInput,
    wrappedPoolState: PoolState,
    swapKind: SwapKind,
    tokenInWrapInfo: TokenWrapInfo,
    tokenOutWrapInfo: TokenWrapInfo,
    amount: bigint,
): Promise<bigint> {
    const poolTokenIn = tokenInWrapInfo.wrapped ?? tokenInWrapInfo.token;
    const poolTokenOut = tokenOutWrapInfo.wrapped ?? tokenOutWrapInfo.token;
    const tokenIn = {
        address: poolTokenIn.address,
        decimals: poolTokenIn.decimals,
    };
    const tokenOut = {
        address: poolTokenOut.address,
        decimals: poolTokenOut.decimals,
    };
    const givenWrapInfo =
        swapKind === SwapKind.GivenIn ? tokenInWrapInfo : tokenOutWrapInfo;
    let givenAmount = amount;
    if (givenWrapInfo.shouldWrap) {
        givenAmount = await previewErc4626(
            input.rpcUrl,
            input.chainId,
            givenWrapInfo.wrapped!.address,
            swapKind === SwapKind.GivenIn
                ? 'previewDeposit'
                : 'previewWithdraw',
            amount,
        );
        if (givenAmount === 0n) {
            throw new Error('ERC4626 preview returned zero shares');
        }
    }

    const directSwap = new Swap({
        chainId: input.chainId,
        userData: input.userData,
        swapKind,
        paths: [
            {
                tokens: [tokenIn, tokenOut],
                pools: [wrappedPoolState.address],
                inputAmountRaw:
                    swapKind === SwapKind.GivenIn ? givenAmount : 0n,
                outputAmountRaw:
                    swapKind === SwapKind.GivenOut ? givenAmount : 0n,
                protocolVersion: 3,
            },
        ],
    });
    const result = await directSwap.query(
        input.rpcUrl,
        undefined,
        input.sender,
    );
    const resultAmount =
        result.swapKind === SwapKind.GivenIn
            ? result.expectedAmountOut.amount
            : result.expectedAmountIn.amount;
    const resultWrapInfo =
        swapKind === SwapKind.GivenIn ? tokenOutWrapInfo : tokenInWrapInfo;
    if (!resultWrapInfo.shouldWrap) return resultAmount;
    return previewErc4626(
        input.rpcUrl,
        input.chainId,
        resultWrapInfo.wrapped!.address,
        swapKind === SwapKind.GivenIn ? 'previewRedeem' : 'previewMint',
        resultAmount,
    );
}

type TokenWrapInfo = {
    token: InputToken;
    shouldWrap: boolean;
    wrapped: InputToken | undefined;
};

function getTokenWrapInfo(
    tokens: PoolTokenWithUnderlying[],
    tokenIndex: number,
    token: InputToken,
): TokenWrapInfo {
    // The same address may be a pool token in one slot and an underlying in
    // another. The query output and deltas are already in pool-index order.
    const poolToken = tokens.find((t) => t.index === tokenIndex);
    if (poolToken && isSameAddress(poolToken.address, token.address))
        return {
            token: poolToken,
            shouldWrap: false,
            wrapped: undefined,
        };

    if (
        !poolToken?.underlyingToken ||
        !isSameAddress(poolToken.underlyingToken.address, token.address)
    )
        throw new SDKError(
            'Price Impact',
            'Add Liquidity Boosted Unbalanced',
            `Cannot map token ${token.address} to pool index ${tokenIndex}`,
        );
    return {
        token: token,
        shouldWrap: true,
        wrapped: poolToken,
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
