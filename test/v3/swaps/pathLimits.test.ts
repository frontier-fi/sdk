import { describe, expect, it } from 'vitest';
import { Slippage } from '@/entities/slippage';
import { getPathLimits } from '@/entities/swap/limits';
import { SwapKind } from '@/types';
import { zeroAddress } from 'viem';

describe('V3 split-route slippage limits', () => {
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
                    const limit = slippage.applyTo(
                        pathAmounts.reduce((sum, amount) => sum + amount, 0n),
                        direction,
                    );
                    const limits = getPathLimits(
                        slippage,
                        { swapKind, pathAmounts, to: zeroAddress },
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
    }

    it('rejects inconsistent path and aggregate quotes', () => {
        expect(() =>
            getPathLimits(
                Slippage.fromPercentage('1'),
                {
                    swapKind: SwapKind.GivenIn,
                    pathAmounts: [100n, 100n],
                    to: zeroAddress,
                },
                199n,
            ),
        ).toThrow('Swap path amounts do not match the aggregate quote');
    });
});
