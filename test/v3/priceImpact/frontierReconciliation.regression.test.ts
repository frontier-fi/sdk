import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractFunctionRevertedError, encodeErrorResult } from 'viem';
import { PriceImpact } from '@/entities/priceImpact';
import { AddLiquidityKind } from '@/entities/addLiquidity/types';
import type { AddLiquidityUnbalancedInput } from '@/entities/addLiquidity/types';
import { RemoveLiquidityKind } from '@/entities/removeLiquidity/types';
import type { SwapInput } from '@/entities/swap/types';
import { SwapKind } from '@/types';
import type { Address } from '@/types';
import { Token } from '@/entities/token';
import { TokenAmount } from '@/entities/tokenAmount';
import type { PoolState, PoolStateWithUnderlyings } from '@/entities/types';

const mocks = vi.hoisted(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    boostedAdd: vi.fn(),
    boostedRemove: vi.fn(),
    swap: vi.fn(),
}));

vi.mock('@/entities/addLiquidity', () => ({
    AddLiquidity: class {
        query = mocks.add;
    },
}));
vi.mock('@/entities/removeLiquidity', () => ({
    RemoveLiquidity: class {
        query = mocks.remove;
    },
}));
vi.mock('@/entities/addLiquidityBoosted', () => ({
    AddLiquidityBoostedV3: class {
        query = mocks.boostedAdd;
    },
}));
vi.mock('@/entities/removeLiquidityBoosted', () => ({
    RemoveLiquidityBoostedV3: class {
        query = mocks.boostedRemove;
    },
}));
vi.mock('@/entities/swap', () => ({
    Swap: class {
        constructor(private input: SwapInput) {}
        query(rpcUrl?: string, block?: bigint, sender?: Address) {
            return mocks.swap(this.input, rpcUrl, block, sender);
        }
    },
}));

const chainId = 11155111;
const address = (id: number): Address =>
    `0x${id.toString(16).padStart(40, '0')}`;
const sender = address(90);
const userData = '0x1234' as const;
const bpt = new Token(chainId, address(100), 18);
const wad = 10n ** 18n;

type SwapQuote = {
    kind: SwapKind;
    from: number;
    to: number;
    amount: bigint;
    result: bigint;
};
type Fixture = {
    name: string;
    deltas: bigint[];
    swaps: SwapQuote[];
    residual: bigint[];
    impact: bigint;
    inputs?: bigint[];
    decimals?: number[];
    zeroBPT?: boolean;
};
const fixtures: Fixture[] = [
    {
        name: 'credits exact-input proceeds to the deficit',
        deltas: [10n, -20n],
        swaps: [
            { kind: SwapKind.GivenIn, from: 0, to: 1, amount: 10n, result: 8n },
        ],
        residual: [0n, -12n],
        impact: 60_000_000_000_000_000n,
    },
    {
        name: 'subtracts exact-output cost before the next exact-input swap',
        deltas: [20n, -10n, -20n],
        decimals: [6, 18, 8],
        swaps: [
            {
                kind: SwapKind.GivenOut,
                from: 0,
                to: 1,
                amount: 10n,
                result: 12n,
            },
            { kind: SwapKind.GivenIn, from: 0, to: 2, amount: 8n, result: 6n },
        ],
        residual: [0n, 0n, -14n],
        impact: 70_000_000_000_000_000n,
    },
    {
        name: 'uses the remaining deficit instead of the cleared exact-output token',
        deltas: [30n, -10n, -10n],
        swaps: [
            {
                kind: SwapKind.GivenOut,
                from: 0,
                to: 1,
                amount: 10n,
                result: 15n,
            },
            {
                kind: SwapKind.GivenOut,
                from: 0,
                to: 2,
                amount: 10n,
                result: 20n,
            },
        ],
        residual: [-5n, 0n, 0n],
        impact: 25_000_000_000_000_000n,
    },
    {
        name: 'terminates on exact cancellation without quoting a zero delta',
        deltas: [10n, -10n, 0n],
        swaps: [
            {
                kind: SwapKind.GivenOut,
                from: 0,
                to: 1,
                amount: 10n,
                result: 10n,
            },
        ],
        residual: [0n, 0n, 0n],
        impact: 0n,
    },
    {
        name: 'continues when exact-input proceeds turn a deficit into a surplus',
        deltas: [5n, -10n, -10n, 20n],
        swaps: [
            { kind: SwapKind.GivenIn, from: 0, to: 1, amount: 5n, result: 12n },
            { kind: SwapKind.GivenIn, from: 1, to: 2, amount: 2n, result: 1n },
            {
                kind: SwapKind.GivenOut,
                from: 3,
                to: 2,
                amount: 9n,
                result: 22n,
            },
        ],
        residual: [0n, 0n, 0n, -2n],
        impact: 10_000_000_000_000_000n,
    },
    {
        name: 'uses an existing single deficit without unnecessary delta quotes',
        deltas: [0n, -5n, 0n],
        swaps: [],
        residual: [0n, -5n, 0n],
        impact: 25_000_000_000_000_000n,
    },
    {
        name: 'accounts for all deficits when there is no surplus',
        deltas: [-3n, -5n, -7n],
        swaps: [
            { kind: SwapKind.GivenOut, from: 0, to: 1, amount: 5n, result: 6n },
            { kind: SwapKind.GivenOut, from: 0, to: 2, amount: 7n, result: 8n },
        ],
        residual: [-17n, 0n, 0n],
        impact: 85_000_000_000_000_000n,
    },
    {
        name: 'consolidates deficits after the last surplus is exhausted',
        deltas: [5n, -10n, -10n],
        swaps: [
            { kind: SwapKind.GivenIn, from: 0, to: 1, amount: 5n, result: 4n },
            {
                kind: SwapKind.GivenOut,
                from: 1,
                to: 2,
                amount: 10n,
                result: 11n,
            },
        ],
        residual: [0n, -17n, 0n],
        impact: 85_000_000_000_000_000n,
    },
    {
        name: 'values a residual in a deposited token instead of dividing by zero',
        inputs: [0n, 100n, 100n],
        deltas: [20n, -10n, -10n],
        swaps: [
            {
                kind: SwapKind.GivenOut,
                from: 0,
                to: 1,
                amount: 10n,
                result: 10n,
            },
            {
                kind: SwapKind.GivenOut,
                from: 0,
                to: 2,
                amount: 10n,
                result: 11n,
            },
            { kind: SwapKind.GivenOut, from: 1, to: 0, amount: 1n, result: 2n },
        ],
        residual: [0n, -2n, 0n],
        impact: 10_000_000_000_000_000n,
    },
    {
        name: 'keeps nonzero token balances when their BPT estimates round to zero',
        deltas: [20n, -10n, -20n],
        zeroBPT: true,
        swaps: [
            {
                kind: SwapKind.GivenOut,
                from: 0,
                to: 1,
                amount: 10n,
                result: 12n,
            },
            {
                kind: SwapKind.GivenOut,
                from: 0,
                to: 2,
                amount: 20n,
                result: 22n,
            },
        ],
        residual: [-14n, 0n, 0n],
        impact: 70_000_000_000_000_000n,
    },
    {
        name: 'returns zero for proportional deposits without internal swaps',
        deltas: [0n, 0n, 0n],
        swaps: [],
        residual: [0n, 0n, 0n],
        impact: 0n,
    },
    {
        name: 'returns zero for rounding surpluses without a deficit',
        deltas: [1n, 0n, 1n],
        swaps: [],
        residual: [1n, 0n, 1n],
        impact: 0n,
    },
];

beforeEach(() => vi.resetAllMocks());

describe.each(['regular', 'boosted'] as const)(
    'Frontier %s unbalanced price impact',
    (mode) => {
        function setup(fixture: Fixture) {
            const tokens = fixture.deltas.map(
                (_, i) =>
                    new Token(
                        chainId,
                        address(i + 1),
                        fixture.decimals?.[i] ?? 18,
                    ),
            );
            const unit = (i: number) => 10n ** BigInt(tokens[i].decimals);
            const inputs = fixture.inputs ?? tokens.map(() => 100n);
            const amountsIn = tokens.map((t, i) =>
                TokenAmount.fromRawAmount(t, inputs[i] * unit(i)),
            );
            const amountsOut = tokens.map((t, i) =>
                TokenAmount.fromRawAmount(
                    t,
                    (inputs[i] + fixture.deltas[i]) * unit(i),
                ),
            );
            const pool: PoolStateWithUnderlyings = {
                id: bpt.address,
                address: bpt.address,
                type: 'WEIGHTED',
                protocolVersion: 3,
                tokens: tokens.map((t, i) => ({
                    index: i,
                    address:
                        mode === 'boosted' && i < 2
                            ? address(i + 200)
                            : t.address,
                    decimals: t.decimals,
                    underlyingToken:
                        mode === 'boosted' && i < 2
                            ? {
                                  index: i,
                                  address: t.address,
                                  decimals: t.decimals,
                              }
                            : null,
                })),
            };
            const input: AddLiquidityUnbalancedInput = {
                chainId,
                rpcUrl: 'http://unused.invalid',
                kind: AddLiquidityKind.Unbalanced,
                amountsIn: amountsIn.map((a) => a.toInputAmount()),
                sender,
                userData,
            };
            const add = mode === 'regular' ? mocks.add : mocks.boostedAdd;
            const remove =
                mode === 'regular' ? mocks.remove : mocks.boostedRemove;
            add.mockResolvedValueOnce({
                amountsIn,
                bptOut: TokenAmount.fromRawAmount(bpt, 100n * wad),
            });
            add.mockImplementation(
                async (deltaInput: AddLiquidityUnbalancedInput) => {
                    const [delta] = deltaInput.amountsIn;
                    expect(delta.rawAmount).toBeGreaterThan(0n);
                    return {
                        bptOut: TokenAmount.fromRawAmount(
                            bpt,
                            fixture.zeroBPT
                                ? 0n
                                : delta.rawAmount *
                                      10n ** BigInt(18 - delta.decimals),
                        ),
                    };
                },
            );
            remove.mockResolvedValue({ amountsOut });

            // Independently account for every quoted token transfer. Fixtures
            // specify the expected final balances and ABA impact explicitly.
            const balances = fixture.deltas.map((d, i) => d * unit(i));
            let swapIndex = 0;
            mocks.swap.mockImplementation(async (swapInput: SwapInput) => {
                const quote = fixture.swaps[swapIndex++];
                expect(quote).toBeDefined();
                const path = swapInput.paths[0];
                expect(swapInput.swapKind).toBe(quote.kind);
                expect(path.tokens[0].address).toBe(tokens[quote.from].address);
                expect(path.tokens[path.tokens.length - 1].address).toBe(
                    tokens[quote.to].address,
                );
                if (mode === 'boosted') {
                    expect(path.isBuffer).toEqual([
                        ...(quote.from < 2 ? [true] : []),
                        false,
                        ...(quote.to < 2 ? [true] : []),
                    ]);
                }
                if (quote.kind === SwapKind.GivenIn) {
                    expect(path.inputAmountRaw).toBe(
                        quote.amount * unit(quote.from),
                    );
                    expect(path.outputAmountRaw).toBe(0n);
                    balances[quote.from] -= path.inputAmountRaw;
                    balances[quote.to] += quote.result * unit(quote.to);
                    return {
                        swapKind: quote.kind,
                        expectedAmountOut: TokenAmount.fromRawAmount(
                            tokens[quote.to],
                            quote.result * unit(quote.to),
                        ),
                    };
                }
                expect(path.outputAmountRaw).toBe(
                    quote.amount * unit(quote.to),
                );
                expect(path.inputAmountRaw).toBe(0n);
                balances[quote.from] -= quote.result * unit(quote.from);
                balances[quote.to] += path.outputAmountRaw;
                return {
                    swapKind: quote.kind,
                    expectedAmountIn: TokenAmount.fromRawAmount(
                        tokens[quote.from],
                        quote.result * unit(quote.from),
                    ),
                };
            });

            return {
                input,
                pool,
                add,
                remove,
                balances,
                unit,
                calculate: () =>
                    mode === 'regular'
                        ? PriceImpact.addLiquidityUnbalanced(
                              input,
                              pool as PoolState,
                          )
                        : PriceImpact.addLiquidityUnbalancedBoosted(
                              input,
                              pool,
                          ),
            };
        }

        it.each(fixtures)('$name', async (fixture) => {
            const { calculate, input, add, remove, balances, unit } =
                setup(fixture);
            const originalInput = structuredClone(input);
            const result = await calculate();

            expect(result.amount).toBe(fixture.impact);
            expect(balances).toEqual(
                fixture.residual.map((d, i) => d * unit(i)),
            );
            expect(mocks.swap).toHaveBeenCalledTimes(fixture.swaps.length);
            expect(mocks.swap.mock.calls.length).toBeLessThanOrEqual(
                fixture.deltas.length,
            );
            expect(input).toEqual(originalInput);
            for (const [queryInput] of [
                ...add.mock.calls,
                ...remove.mock.calls,
            ]) {
                expect(queryInput.sender).toBe(sender);
                expect(queryInput.userData).toBe(userData);
            }
            for (const [swapInput, rpcUrl, block, querySender] of mocks.swap
                .mock.calls) {
                expect(swapInput.userData).toBe(userData);
                expect(rpcUrl).toBe(input.rpcUrl);
                expect(block).toBeUndefined();
                expect(querySender).toBe(sender);
            }
        });

        it('preserves anonymous query defaults', async () => {
            const { calculate, input, remove } = setup(fixtures[0]);
            delete input.sender;
            delete input.userData;
            expect((await calculate()).amount).toBe(fixtures[0].impact);
            expect(remove.mock.calls[0][0].sender).toBeUndefined();
            expect(remove.mock.calls[0][0].userData).toBeUndefined();
            expect(mocks.swap.mock.calls[0][0].userData).toBeUndefined();
            expect(mocks.swap.mock.calls[0][3]).toBeUndefined();
        });

        it('propagates failed reconciliation swaps instead of returning zero', async () => {
            const { calculate } = setup(fixtures[0]);
            mocks.swap.mockRejectedValue(new Error('TradeAmountTooSmall'));
            await expect(calculate()).rejects.toThrow('Swap step');
        });

        it('does not suppress minimum-wrap failures or inflate a delta to make a quote', async () => {
            const { calculate, add } = setup({
                ...fixtures[0],
                decimals: [0, 0],
            });
            const abi = [
                { type: 'error', name: 'WrapAmountTooSmall', inputs: [] },
            ] as const;
            add.mockImplementation(
                async (deltaInput: AddLiquidityUnbalancedInput) => {
                    expect(deltaInput.amountsIn[0].rawAmount).toBe(10n);
                    throw new ContractFunctionRevertedError({
                        abi,
                        functionName: 'queryAddLiquidityUnbalanced',
                        data: encodeErrorResult({
                            abi,
                            errorName: 'WrapAmountTooSmall',
                        }),
                    });
                },
            );
            await expect(calculate()).rejects.toThrow('Delta add step');
            expect(add.mock.calls[1][0].amountsIn[0].rawAmount).toBe(10n);
        });
    },
);

describe('Frontier reverse price-impact query context', () => {
    const token = new Token(chainId, address(1), 18);
    const pool: PoolState = {
        id: bpt.address,
        address: bpt.address,
        type: 'WEIGHTED',
        protocolVersion: 3,
        tokens: [
            { index: 0, address: token.address, decimals: token.decimals },
        ],
    };

    it('preserves sender, userData and the existing remove input block in both directions', async () => {
        const amountsOut = [TokenAmount.fromRawAmount(token, 90n * wad)];
        mocks.remove.mockResolvedValue({
            amountsOut,
            bptIn: TokenAmount.fromRawAmount(bpt, 100n * wad),
        });
        mocks.add.mockResolvedValue({
            bptOut: TokenAmount.fromRawAmount(bpt, 80n * wad),
        });
        const input = {
            chainId,
            rpcUrl: 'http://unused.invalid',
            kind: RemoveLiquidityKind.SingleTokenExactIn as const,
            bptIn: TokenAmount.fromRawAmount(bpt, 100n * wad).toInputAmount(),
            tokenOut: token.address,
            sender,
            userData,
            block: 123n,
        };

        const result = await PriceImpact.removeLiquidity(input, pool);

        expect(result.amount).toBe(100_000_000_000_000_000n);
        expect(mocks.remove).toHaveBeenCalledWith(input, pool, input.block);
        expect(mocks.add).toHaveBeenCalledWith(
            expect.objectContaining({
                sender,
                userData,
                kind: AddLiquidityKind.Unbalanced,
                amountsIn: amountsOut.map((a) => a.toInputAmount()),
            }),
            pool,
            input.block,
        );
    });

    it('preserves sender and userData in the reverse single-token addition', async () => {
        mocks.add.mockResolvedValue({
            amountsIn: [TokenAmount.fromRawAmount(token, 100n * wad)],
        });
        mocks.remove.mockResolvedValue({
            amountsOut: [TokenAmount.fromRawAmount(token, 90n * wad)],
        });

        const result = await PriceImpact.addLiquiditySingleToken(
            {
                chainId,
                rpcUrl: 'http://unused.invalid',
                kind: AddLiquidityKind.SingleToken,
                bptOut: TokenAmount.fromRawAmount(
                    bpt,
                    100n * wad,
                ).toInputAmount(),
                tokenIn: token.address,
                sender,
                userData,
            },
            pool,
        );

        expect(result.amount).toBe(50_000_000_000_000_000n);
        expect(mocks.remove).toHaveBeenCalledWith(
            expect.objectContaining({
                sender,
                userData,
                kind: RemoveLiquidityKind.SingleTokenExactIn,
            }),
            pool,
        );
    });
});
