import { SwapKind } from '@/types';
import { Slippage } from '../slippage';
import { TokenAmount } from '../tokenAmount';
import { QueryOutputBase } from './types';

/**
 * Apply slippage to expectedAmount. GivenIn: Remove to give minOut. GivenOut: Add to give maxIn.
 * @param slippage
 * @param swapKind
 * @param expectedAmount
 * @returns
 */
export function getLimitAmount(
    slippage: Slippage,
    swapKind: SwapKind,
    expectedAmount: TokenAmount,
): TokenAmount {
    let limitAmount: bigint;
    if (swapKind === SwapKind.GivenIn) {
        limitAmount = slippage.applyTo(expectedAmount.amount, -1);
    } else {
        limitAmount = slippage.applyTo(expectedAmount.amount);
    }
    return TokenAmount.fromRawAmount(expectedAmount.token, limitAmount);
}

/**
 * Apply slippage to pathAmounts. GivenIn: Remove to give minOut. GivenOut: Add to give maxIn.
 * @param slippage
 * @param expected
 * @returns
 */
export function getPathLimits(
    slippage: Slippage,
    expected: QueryOutputBase,
    maxAmount: bigint,
): bigint[] | undefined {
    if (!expected.pathAmounts) return undefined;
    const direction = expected.swapKind === SwapKind.GivenIn ? -1 : 1;
    let cumulativeAmount = 0n;
    let cumulativeLimit = 0n;
    // Carry rounding across paths instead of adding all dust to one path,
    // which can make a small exact-in path require more than its quoted output.
    const pathLimits = expected.pathAmounts.map((amount) => {
        cumulativeAmount += amount;
        const nextLimit = slippage.applyTo(cumulativeAmount, direction);
        const limit = nextLimit - cumulativeLimit;
        cumulativeLimit = nextLimit;
        return limit;
    });
    if (cumulativeLimit !== maxAmount) {
        throw new Error('Swap path amounts do not match the aggregate quote');
    }
    return pathLimits;
}
