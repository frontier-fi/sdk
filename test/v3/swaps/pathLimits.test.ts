import { Slippage } from '@/entities/slippage';
import { getPathLimits } from '@/entities/swap/limits';
import { ExactInQueryOutput, ExactOutQueryOutput } from '@/entities/swap/types';
import { Token } from '@/entities/token';
import { TokenAmount } from '@/entities/tokenAmount';
import { SwapKind } from '@/types';
import { SDKError } from '@/utils/errors';
import { zeroAddress } from 'viem';
import { describe, expect, it } from 'vitest';

describe('V3 split-route slippage limits', () => {
    const token = new Token(1, zeroAddress, 18);
    const quote = (
        swapKind: SwapKind,
        total: bigint,
        pathAmounts?: bigint[],
    ): ExactInQueryOutput | ExactOutQueryOutput => {
        const fixedAmount = TokenAmount.fromRawAmount(token, 999n);
        const expectedAmount = TokenAmount.fromRawAmount(token, total);
        return swapKind === SwapKind.GivenIn
            ? {
                  swapKind,
                  pathAmounts,
                  to: zeroAddress,
                  amountIn: fixedAmount,
                  expectedAmountOut: expectedAmount,
              }
            : {
                  swapKind,
                  pathAmounts,
                  to: zeroAddress,
                  amountOut: fixedAmount,
                  expectedAmountIn: expectedAmount,
              };
    };
    const mismatch = new SDKError(
        'Input Validation',
        'Swap',
        'Swap path amounts do not match the aggregate quote',
    );
    const cases = [
        [1n, 1n, 1000001n],
        [1000001n, 1n, 1n],
        [1n, 1000001n, 1n],
        [0n, 1n, 1n, 0n],
        Array<bigint>(20).fill(1n),
        [1000000000000000001n, 999999999999999999n, 1n],
    ];

    for (const swapKind of [SwapKind.GivenIn, SwapKind.GivenOut]) {
        for (const percentage of ['0', '0.01', '1', '50', '100'] as const) {
            it(`preserves aggregate and per-path bounds for kind ${swapKind}, ${percentage}%`, () => {
                const slippage = Slippage.fromPercentage(percentage);
                const direction = swapKind === SwapKind.GivenIn ? -1 : 1;
                for (const pathAmounts of cases) {
                    const original = [...pathAmounts];
                    const total = pathAmounts.reduce(
                        (sum, amount) => sum + amount,
                        0n,
                    );
                    const limit = slippage.applyTo(total, direction);
                    const limits = getPathLimits(
                        slippage,
                        quote(swapKind, total, pathAmounts),
                        limit,
                    )!;

                    expect(
                        limits.reduce((sum, amount) => sum + amount, 0n),
                    ).toBe(limit);
                    expect(limits).toHaveLength(pathAmounts.length);
                    limits.forEach((amount, i) => {
                        expect(amount).toBeGreaterThanOrEqual(0n);
                        if (swapKind === SwapKind.GivenIn) {
                            expect(amount).toBeLessThanOrEqual(pathAmounts[i]);
                        } else {
                            expect(amount).toBeGreaterThanOrEqual(
                                pathAmounts[i],
                            );
                        }
                        if (pathAmounts[i] === 0n) expect(amount).toBe(0n);
                    });
                    expect(pathAmounts).toEqual(original);
                }
            });
        }

        for (const total of [199n, 201n]) {
            it(`rejects a raw mismatch for kind ${swapKind}, quoted total ${total}, even when the adjusted path sum matches the supplied limit`, () => {
                const slippage = Slippage.fromPercentage('1');
                const direction = swapKind === SwapKind.GivenIn ? -1 : 1;
                const limit = slippage.applyTo(200n, direction);
                const getLimits = () =>
                    getPathLimits(
                        slippage,
                        quote(swapKind, total, [100n, 100n]),
                        limit,
                    );

                expect(getLimits).toThrow(SDKError);
                expect(getLimits).toThrow(mismatch);
            });
        }

        it(`rejects an incorrect adjusted limit with a consistent raw quote for kind ${swapKind}`, () => {
            const slippage = Slippage.fromPercentage('1');
            const direction = swapKind === SwapKind.GivenIn ? -1 : 1;
            const getLimits = () =>
                getPathLimits(
                    slippage,
                    quote(swapKind, 200n, [100n, 100n]),
                    slippage.applyTo(200n, direction) + 1n,
                );

            expect(getLimits).toThrow(SDKError);
            expect(getLimits).toThrow(mismatch);
        });

        it(`returns undefined when path amounts are absent for kind ${swapKind}`, () => {
            expect(
                getPathLimits(
                    Slippage.fromPercentage('0'),
                    quote(swapKind, 200n),
                    200n,
                ),
            ).toBeUndefined();
        });
    }

    for (const [percentage, total] of [
        ['1', 201n],
        ['100', 9999n],
    ] as const) {
        it(`rejects raw exact-in mismatches hidden by ${percentage}% slippage`, () => {
            const slippage = Slippage.fromPercentage(percentage);
            const limit = slippage.applyTo(total, -1);
            expect(slippage.applyTo(200n, -1)).toBe(limit);
            const getLimits = () =>
                getPathLimits(
                    slippage,
                    quote(SwapKind.GivenIn, total, [100n, 100n]),
                    limit,
                );

            expect(getLimits).toThrow(SDKError);
            expect(getLimits).toThrow(mismatch);
        });
    }
});
