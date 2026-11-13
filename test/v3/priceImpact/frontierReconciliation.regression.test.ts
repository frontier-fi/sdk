import { AddLiquidityKind } from '@/entities/addLiquidity/types';
import type { AddLiquidityUnbalancedInput } from '@/entities/addLiquidity/types';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';
import { PriceImpact } from '@/entities/priceImpact';
import { RemoveLiquidityKind } from '@/entities/removeLiquidity/types';
import type { SwapInput } from '@/entities/swap/types';
import { Token } from '@/entities/token';
import { TokenAmount } from '@/entities/tokenAmount';
import type { PoolState, PoolStateWithUnderlyings } from '@/entities/types';
import { SwapKind } from '@/types';
import type { Address } from '@/types';
import { SDKError } from '@/utils';
import {
    BaseError,
    ContractFunctionRevertedError,
    decodeErrorResult,
    encodeErrorResult,
    encodeFunctionData,
    encodeFunctionResult,
    erc4626Abi,
} from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    boostedAdd: vi.fn(),
    boostedRemove: vi.fn(),
    swap: vi.fn(),
    preview: vi.fn(),
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
vi.mock('@/entities/priceImpact/erc4626Preview', () => ({
    previewErc4626: mocks.preview,
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
        name: 'uses exact-input on the final pair to avoid a reverse swap',
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
                kind: SwapKind.GivenIn,
                from: 0,
                to: 2,
                amount: 10n,
                result: 9n,
            },
        ],
        residual: [0n, 0n, -1n],
        impact: 5_000_000_000_000_000n,
    },
    {
        name: 'reconciles a single-sided deposit without minimum-sensitive BPT ranking quotes',
        inputs: [0n, 100n],
        deltas: [20n, -20n],
        zeroBPT: true,
        swaps: [
            {
                kind: SwapKind.GivenIn,
                from: 0,
                to: 1,
                amount: 20n,
                result: 18n,
            },
        ],
        residual: [0n, -2n],
        impact: 10_000_000_000_000_000n,
    },
    {
        name: 'normalizes a multi-token deficit in the largest scaled deposit',
        inputs: [1n, 1000n],
        decimals: [18, 6],
        deltas: [-1n, -100n],
        swaps: [
            { kind: SwapKind.GivenOut, from: 1, to: 0, amount: 1n, result: 2n },
        ],
        residual: [0n, -102n],
        impact: 51_000_000_000_000_000n,
    },
    {
        name: 'keeps the largest-deposit normalization after token reordering',
        inputs: [1000n, 1n],
        decimals: [6, 18],
        deltas: [-100n, -1n],
        swaps: [
            { kind: SwapKind.GivenOut, from: 0, to: 1, amount: 1n, result: 2n },
        ],
        residual: [-102n, 0n],
        impact: 51_000_000_000_000_000n,
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

beforeEach(() => {
    vi.resetAllMocks();
    mocks.preview.mockRejectedValue(
        new Error('ERC4626 preview not configured'),
    );
});

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
            if (fixture.inputs?.filter((a) => a > 0n).length === 1) {
                // No auxiliary add query is needed when the final direction
                // is determined by the deposited token, even if it would
                // return zero BPT or revert for a sub-minimum probe.
                expect(add).toHaveBeenCalledTimes(1);
            }
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

const minimumErrorAbi = [
    { type: 'error', name: 'TradeAmountTooSmall', inputs: [] },
    {
        type: 'error',
        name: 'WrapAmountTooSmall',
        inputs: [{ name: 'wrappedToken', type: 'address' }],
    },
    { type: 'error', name: 'AmountGivenZero', inputs: [] },
    { type: 'error', name: 'SwapLimit', inputs: [] },
    { type: 'error', name: 'PoolPaused', inputs: [] },
] as const;

type MinimumErrorName = (typeof minimumErrorAbi)[number]['name'];

function decodedRevert(errorName: MinimumErrorName) {
    // Model the actual viem error chain: the outer call error has a decoded
    // ContractFunctionRevertedError as its cause.
    return new BaseError('contract call failed', {
        cause: new ContractFunctionRevertedError({
            abi: minimumErrorAbi,
            functionName: 'query',
            data:
                errorName === 'WrapAmountTooSmall'
                    ? encodeErrorResult({
                          abi: minimumErrorAbi,
                          errorName,
                          args: [address(200)],
                      })
                    : encodeErrorResult({ abi: minimumErrorAbi, errorName }),
        }),
    });
}

it.each([
    ['router', balancerRouterAbiExtended],
    ['batch router', balancerBatchRouterAbiExtended],
    ['boosted router', balancerCompositeLiquidityRouterBoostedAbiExtended],
] as const)(
    'decodes the deployed wrap error and wrapper address with the %s ABI',
    (_name, abi) => {
        const data = encodeErrorResult({
            abi: minimumErrorAbi,
            errorName: 'WrapAmountTooSmall',
            args: [address(200)],
        });
        const decoded = decodeErrorResult({ abi, data });
        expect(decoded.errorName).toBe('WrapAmountTooSmall');
        expect((decoded.args?.[0] as string).toLowerCase()).toBe(
            address(200).toLowerCase(),
        );
    },
);

type RawFixture = {
    inputs: bigint[];
    deltas: bigint[];
    protocolVersion?: 2 | 3;
    tokenAddresses?: Address[];
    decimals?: number[];
    wrapped?: boolean[];
    wrapperDecimals?: number[];
};

function setupRaw(mode: 'regular' | 'boosted', fixture: RawFixture) {
    const tokens = fixture.inputs.map(
        (_, i) =>
            new Token(
                chainId,
                fixture.tokenAddresses?.[i] ?? address(i + 1),
                fixture.decimals?.[i] ?? 18,
            ),
    );
    const wrapped = fixture.wrapped ?? tokens.map(() => mode === 'boosted');
    const amountsIn = tokens.map((token, i) =>
        TokenAmount.fromRawAmount(token, fixture.inputs[i]),
    );
    const amountsOut = tokens.map((token, i) =>
        TokenAmount.fromRawAmount(token, fixture.inputs[i] + fixture.deltas[i]),
    );
    const pool: PoolStateWithUnderlyings = {
        id: bpt.address,
        address: bpt.address,
        type: 'WEIGHTED',
        protocolVersion: fixture.protocolVersion ?? 3,
        tokens: tokens.map((token, i) => ({
            index: i,
            address: wrapped[i] ? address(200 + i) : token.address,
            decimals: wrapped[i]
                ? (fixture.wrapperDecimals?.[i] ?? token.decimals)
                : token.decimals,
            underlyingToken: wrapped[i]
                ? { index: i, address: token.address, decimals: token.decimals }
                : null,
        })),
    };
    const input: AddLiquidityUnbalancedInput = {
        chainId,
        rpcUrl: 'http://unused.invalid',
        kind: AddLiquidityKind.Unbalanced,
        amountsIn: amountsIn.map((amount) => amount.toInputAmount()),
        sender,
        userData,
    };
    const add = mode === 'regular' ? mocks.add : mocks.boostedAdd;
    const remove = mode === 'regular' ? mocks.remove : mocks.boostedRemove;
    add.mockResolvedValueOnce({
        amountsIn,
        bptOut: TokenAmount.fromRawAmount(bpt, 100n * wad),
    });
    add.mockImplementation(async (deltaInput: AddLiquidityUnbalancedInput) => {
        const delta = deltaInput.amountsIn[0];
        return {
            bptOut: TokenAmount.fromRawAmount(
                bpt,
                TokenAmount.fromRawAmount(
                    new Token(chainId, delta.address, delta.decimals),
                    delta.rawAmount,
                ).scale18,
            ),
        };
    });
    remove.mockResolvedValue({ amountsOut });
    return {
        tokens,
        pool,
        input,
        add,
        remove,
        calculate: () =>
            mode === 'regular'
                ? PriceImpact.addLiquidityUnbalanced(input, pool)
                : PriceImpact.addLiquidityUnbalancedBoosted(input, pool),
    };
}

function swapQuote(swapInput: SwapInput, amount: bigint) {
    const path = swapInput.paths[0];
    const quotedToken =
        swapInput.swapKind === SwapKind.GivenIn
            ? path.tokens[path.tokens.length - 1]
            : path.tokens[0];
    const result = TokenAmount.fromRawAmount(
        new Token(chainId, quotedToken.address, quotedToken.decimals),
        amount,
    );
    return swapInput.swapKind === SwapKind.GivenIn
        ? { swapKind: SwapKind.GivenIn, expectedAmountOut: result }
        : { swapKind: SwapKind.GivenOut, expectedAmountIn: result };
}

describe.each(['regular', 'boosted'] as const)(
    'Frontier %s V3 sub-minimum reconciliation',
    (mode) => {
        it.each([
            'TradeAmountTooSmall',
            'WrapAmountTooSmall',
            'AmountGivenZero',
        ] as const)(
            'retires proportional rounding deficits after decoded %s',
            async (errorName) => {
                const { calculate } = setupRaw(mode, {
                    inputs: [1_000_000n, 1_000_000n],
                    deltas: [-1n, -1n],
                });
                mocks.swap.mockRejectedValue(decodedRevert(errorName));
                // The first deficit remains in the ABA calculation; only the
                // unquotable second deficit is retired.
                expect((await calculate()).amount).toBe(500_000_000_000n);
                expect(mocks.swap).toHaveBeenCalledTimes(1);
                expect(mocks.preview).not.toHaveBeenCalled();
            },
        );

        it.each([
            'TradeAmountTooSmall',
            'WrapAmountTooSmall',
            'AmountGivenZero',
        ] as const)(
            're-evaluates the active legs when a dust BPT probe gets %s',
            async (errorName) => {
                const { calculate, add } = setupRaw(mode, {
                    inputs: [1_000_000n, 1_000_000n],
                    deltas: [1n, -2n],
                });
                add.mockRejectedValue(decodedRevert(errorName));
                expect((await calculate()).amount).toBe(1_000_000_000_000n);
                expect(add).toHaveBeenCalledTimes(2);
                expect(mocks.swap).not.toHaveBeenCalled();
                expect(mocks.preview).not.toHaveBeenCalled();
            },
        );

        it.each(['TradeAmountTooSmall', 'WrapAmountTooSmall'] as const)(
            'retires one dust BPT probe on %s and reconciles the other legs',
            async (errorName) => {
                const { calculate, add } = setupRaw(mode, {
                    inputs: [1_000_000n, 1_000_000n, 1_000_000n],
                    deltas: [10_000n, -9_000n, -1n],
                });
                add.mockImplementation(
                    async (deltaInput: AddLiquidityUnbalancedInput) => {
                        const amount = deltaInput.amountsIn[0].rawAmount;
                        if (amount === 1n) throw decodedRevert(errorName);
                        return {
                            bptOut: TokenAmount.fromRawAmount(bpt, amount),
                        };
                    },
                );
                mocks.swap.mockImplementation(async (swapInput: SwapInput) => {
                    expect(swapInput.swapKind).toBe(SwapKind.GivenOut);
                    expect(swapInput.paths[0].outputAmountRaw).toBe(9_000n);
                    return swapQuote(swapInput, 10_100n);
                });
                expect((await calculate()).amount).toBe(50_000_000_000_000n);
                expect(mocks.swap).toHaveBeenCalledTimes(1);
            },
        );

        it.each(['TradeAmountTooSmall', 'WrapAmountTooSmall'] as const)(
            'retires a post-GivenOut remainder on %s without losing the larger deficit',
            async (errorName) => {
                const { calculate, tokens } = setupRaw(mode, {
                    inputs: [1_000_000n, 1_000_000n, 2_000_000n],
                    deltas: [10_000n, -9_000n, -20_000n],
                });
                mocks.swap.mockImplementation(async (swapInput: SwapInput) => {
                    const path = swapInput.paths[0];
                    if (path.outputAmountRaw === 9_000n)
                        return swapQuote(swapInput, 10_001n);
                    expect(path.tokens[0].address).toBe(tokens[2].address);
                    expect(path.outputAmountRaw).toBe(1n);
                    throw decodedRevert(errorName);
                });
                expect((await calculate()).amount).toBe(5_000_000_000_000_000n);
                expect(mocks.swap).toHaveBeenCalledTimes(2);
            },
        );

        it('finishes cleanly when a pairwise swap retires the last deficit', async () => {
            const { calculate } = setupRaw(mode, {
                inputs: [1_000_000n, 1_000_000n],
                deltas: [500n, -1n],
            });
            mocks.swap.mockRejectedValue(decodedRevert('TradeAmountTooSmall'));
            expect((await calculate()).amount).toBe(0n);
            expect(mocks.swap).toHaveBeenCalledTimes(1);
        });

        it('keeps the material deficit when consolidation retires one wei', async () => {
            const unit = 1_000_000n;
            const { calculate } = setupRaw(mode, {
                inputs: [1_000_000n * unit, 1_000_000n * unit],
                deltas: [-100n * unit, -1n],
            });
            mocks.swap.mockRejectedValue(decodedRevert('TradeAmountTooSmall'));
            expect((await calculate()).amount).toBe(50_000_000_000_000n);
            expect(mocks.swap).toHaveBeenCalledTimes(1);
        });

        it('accepts exactly 10 bps of cumulative dust', async () => {
            const { calculate } = setupRaw(mode, {
                inputs: [1_000_000n, 1_000_000n, 1_000_000n],
                deltas: [-10_000n, -500n, -500n],
            });
            mocks.swap.mockRejectedValue(decodedRevert('TradeAmountTooSmall'));
            expect((await calculate()).amount).toBe(5_000_000_000_000_000n);
            expect(mocks.swap).toHaveBeenCalledTimes(2);
        });

        it('rounds each budget charge up before summing', async () => {
            const { calculate } = setupRaw(mode, {
                inputs: [2_001_000n, 2_001_000n, 2_001_000n],
                deltas: [-10_000n, -1_000n, -1_001n],
            });
            // Exactly 10 bps before rounding, but ceil each leg and the total
            // is 1e15 + 1, so the second leg cannot be retired.
            mocks.swap.mockRejectedValue(decodedRevert('TradeAmountTooSmall'));
            await expect(calculate()).rejects.toThrow('Swap step');
            expect(mocks.swap).toHaveBeenCalledTimes(2);
        });

        it('throws when cumulative retired dust would exceed 10 bps', async () => {
            const { calculate } = setupRaw(mode, {
                inputs: [1_000_000n, 1_000_000n, 1_000_000n],
                deltas: [-10_000n, -600n, -600n],
            });
            mocks.swap.mockRejectedValue(decodedRevert('TradeAmountTooSmall'));
            await expect(calculate()).rejects.toThrow('Swap step');
            expect(mocks.swap).toHaveBeenCalledTimes(2);
            expect(mocks.preview).not.toHaveBeenCalled();
        });

        it('does not treat an undeposited one-wei leg as free dust', async () => {
            const { calculate } = setupRaw(mode, {
                inputs: [0n, 1_000_000n],
                deltas: [1n, -10_000n],
            });
            mocks.swap.mockRejectedValue(decodedRevert('TradeAmountTooSmall'));
            await expect(calculate()).rejects.toThrow('Swap step');
        });

        it.each([
            [
                'generic error containing the name',
                () => new Error('TradeAmountTooSmall'),
            ],
            [
                'RPC BaseError',
                () => new BaseError('RPC failed: TradeAmountTooSmall'),
            ],
            ['decoded SwapLimit', () => decodedRevert('SwapLimit')],
            ['decoded PoolPaused', () => decodedRevert('PoolPaused')],
        ])('does not suppress %s', async (_name, error) => {
            const { calculate } = setupRaw(mode, {
                inputs: [1_000_000n, 1_000_000n],
                deltas: [-1n, -1n],
            });
            mocks.swap.mockRejectedValue(error());
            const result = calculate();
            await expect(result).rejects.toBeInstanceOf(SDKError);
            await expect(result).rejects.toThrow('Swap step');
            expect(mocks.preview).not.toHaveBeenCalled();
        });

        it.each([
            [
                'generic error containing the name',
                () => new Error('TradeAmountTooSmall'),
            ],
            [
                'RPC BaseError',
                () => new BaseError('RPC failed: TradeAmountTooSmall'),
            ],
            ['decoded SwapLimit', () => decodedRevert('SwapLimit')],
            ['decoded PoolPaused', () => decodedRevert('PoolPaused')],
        ])('does not suppress %s from delta quoting', async (_name, error) => {
            const { calculate, add } = setupRaw(mode, {
                inputs: [1_000_000n, 1_000_000n],
                deltas: [1n, -2n],
            });
            add.mockRejectedValue(error());
            const result = calculate();
            await expect(result).rejects.toBeInstanceOf(SDKError);
            await expect(result).rejects.toThrow('Delta add step');
            expect(mocks.preview).not.toHaveBeenCalled();
        });
    },
);

it('handles the observed Sepolia proportional rounding deficits', async () => {
    const inputs = [9_963_519_303_131_699_586n, 10_036_495_313_866_019_608n];
    const { calculate } = setupRaw('regular', {
        inputs,
        deltas: [-3n, -3n],
    });
    expect(
        encodeErrorResult({
            abi: minimumErrorAbi,
            errorName: 'TradeAmountTooSmall',
        }),
    ).toBe('0x1ed4d118');
    mocks.swap.mockRejectedValue(decodedRevert('TradeAmountTooSmall'));
    expect((await calculate()).amount).toBe(0n);
    expect(mocks.swap).toHaveBeenCalledTimes(1);
    expect(mocks.swap.mock.calls[0][0].paths[0].outputAmountRaw).toBe(3n);
});

describe('pre-V3 sub-minimum errors', () => {
    it.each([
        'TradeAmountTooSmall',
        'WrapAmountTooSmall',
        'AmountGivenZero',
    ] as const)(
        'propagates a decoded %s from the delta query',
        async (errorName) => {
            const { calculate, add } = setupRaw('regular', {
                inputs: [1_000_000n, 1_000_000n],
                deltas: [1n, -2n],
                protocolVersion: 2,
            });
            add.mockRejectedValue(decodedRevert(errorName));
            await expect(calculate()).rejects.toThrow('Delta add step');
            expect(mocks.swap).not.toHaveBeenCalled();
        },
    );

    it.each([
        'TradeAmountTooSmall',
        'WrapAmountTooSmall',
        'AmountGivenZero',
    ] as const)(
        'propagates a decoded %s from the swap query',
        async (errorName) => {
            const { calculate } = setupRaw('regular', {
                inputs: [1_000_000n, 1_000_000n],
                deltas: [-1n, -1n],
                protocolVersion: 2,
            });
            mocks.swap.mockRejectedValue(decodedRevert(errorName));
            await expect(calculate()).rejects.toThrow('Swap step');
        },
    );
});

describe('Frontier boosted material buffer-floor fallbacks', () => {
    it.each(['WrapAmountTooSmall', 'AmountGivenZero'] as const)(
        'quotes a material delta directly after buffered %s',
        async (errorName) => {
            const { calculate, input, pool, add } = setupRaw('boosted', {
                inputs: [1_000_000n, 1_000_000n],
                deltas: [5_000n, -10_000n],
                decimals: [6, 6],
                wrapperDecimals: [18, 18],
            });
            const originalInput = structuredClone(input);
            add.mockImplementation(
                async (deltaInput: AddLiquidityUnbalancedInput) => {
                    const amount = deltaInput.amountsIn[0].rawAmount;
                    if (amount === 5_000n) throw decodedRevert(errorName);
                    return {
                        bptOut: TokenAmount.fromRawAmount(
                            bpt,
                            amount * 10n ** 12n,
                        ),
                    };
                },
            );
            mocks.preview.mockResolvedValue(5_000n * 10n ** 12n);
            mocks.add.mockResolvedValue({
                bptOut: TokenAmount.fromRawAmount(bpt, 5_000n * 10n ** 12n),
            });
            mocks.swap.mockImplementation(async (swapInput: SwapInput) =>
                swapQuote(swapInput, 4_500n),
            );

            expect((await calculate()).amount).toBe(2_750_000_000_000_000n);
            expect(input).toEqual(originalInput);
            expect(add.mock.calls[1][0].amountsIn[0].rawAmount).toBe(5_000n);
            expect(mocks.preview).toHaveBeenCalledWith(
                input.rpcUrl,
                chainId,
                pool.tokens[0].address,
                'previewDeposit',
                5_000n,
            );
            expect(mocks.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    rpcUrl: input.rpcUrl,
                    chainId,
                    sender,
                    userData,
                    amountsIn: [
                        {
                            address: pool.tokens[0].address,
                            decimals: 18,
                            rawAmount: 5_000n * 10n ** 12n,
                        },
                    ],
                }),
                expect.objectContaining({
                    id: pool.id,
                    tokens: pool.tokens.map(({ index, address, decimals }) => ({
                        index,
                        address,
                        decimals,
                    })),
                }),
            );
            const directPool = mocks.add.mock.calls[0][1];
            expect(
                directPool.tokens.every(
                    (token: object) => !('underlyingToken' in token),
                ),
            ).toBe(true);
            expect(mocks.swap.mock.calls[0].slice(1)).toEqual([
                input.rpcUrl,
                undefined,
                sender,
            ]);
            expect(mocks.swap.mock.calls[0][0].userData).toBe(userData);
        },
    );

    it.each([
        { name: 'both legs wrapped', wrapped: [true, true] },
        { name: 'only the input wrapped', wrapped: [true, false] },
        { name: 'only the output wrapped', wrapped: [false, true] },
    ])('quotes material GivenIn with $name', async ({ wrapped }) => {
        const { calculate, input, pool } = setupRaw('boosted', {
            inputs: [0n, 1_000_000n],
            deltas: [5_000n, -10_000n],
            decimals: [6, 6],
            wrapped,
            wrapperDecimals: [18, 18],
        });
        const originalInput = structuredClone(input);
        mocks.preview.mockImplementation(
            async (
                rpcUrl: string,
                previewChainId: number,
                wrapper: Address,
                functionName: string,
                amount: bigint,
            ) => {
                expect(rpcUrl).toBe(input.rpcUrl);
                expect(previewChainId).toBe(chainId);
                if (functionName === 'previewDeposit') {
                    expect(wrapper).toBe(pool.tokens[0].address);
                    expect(amount).toBe(5_000n);
                    return 5_000n * 10n ** 12n;
                }
                expect(functionName).toBe('previewRedeem');
                expect(wrapper).toBe(pool.tokens[1].address);
                expect(amount).toBe(4_800n * 10n ** 12n);
                return 4_700n;
            },
        );
        mocks.swap.mockImplementation(async (swapInput: SwapInput) => {
            const path = swapInput.paths[0];
            if (path.isBuffer?.some(Boolean)) {
                expect(path.inputAmountRaw).toBe(5_000n);
                throw decodedRevert('WrapAmountTooSmall');
            }
            expect(swapInput.swapKind).toBe(SwapKind.GivenIn);
            expect(path.pools).toEqual([pool.address]);
            expect(path.tokens.map((token) => token.address)).toEqual([
                pool.tokens[0].address,
                pool.tokens[1].address,
            ]);
            expect(path.inputAmountRaw).toBe(
                wrapped[0] ? 5_000n * 10n ** 12n : 5_000n,
            );
            return swapQuote(
                swapInput,
                wrapped[1] ? 4_800n * 10n ** 12n : 4_700n,
            );
        });

        expect((await calculate()).amount).toBe(2_650_000_000_000_000n);
        expect(input).toEqual(originalInput);
        expect(mocks.swap).toHaveBeenCalledTimes(2);
        for (const [swapInput, rpcUrl, block, querySender] of mocks.swap.mock
            .calls) {
            expect(swapInput.userData).toBe(userData);
            expect(rpcUrl).toBe(input.rpcUrl);
            expect(block).toBeUndefined();
            expect(querySender).toBe(sender);
        }
        expect(mocks.preview.mock.calls.map((call) => call[3])).toEqual([
            ...(wrapped[0] ? ['previewDeposit'] : []),
            ...(wrapped[1] ? ['previewRedeem'] : []),
        ]);
    });

    it.each([
        { name: 'both legs wrapped', wrapped: [true, true] },
        { name: 'only the input wrapped', wrapped: [true, false] },
        { name: 'only the output wrapped', wrapped: [false, true] },
    ])('quotes material GivenOut with $name', async ({ wrapped }) => {
        const { calculate, input, pool } = setupRaw('boosted', {
            inputs: [1_000_000n, 1_000_000n],
            deltas: [10_000n, -5_000n],
            decimals: [6, 6],
            wrapped,
            wrapperDecimals: [18, 18],
        });
        const originalInput = structuredClone(input);
        mocks.preview.mockImplementation(
            async (
                rpcUrl: string,
                previewChainId: number,
                wrapper: Address,
                functionName: string,
                amount: bigint,
            ) => {
                expect(rpcUrl).toBe(input.rpcUrl);
                expect(previewChainId).toBe(chainId);
                if (functionName === 'previewWithdraw') {
                    expect(wrapper).toBe(pool.tokens[1].address);
                    expect(amount).toBe(5_000n);
                    return 5_000n * 10n ** 12n;
                }
                expect(functionName).toBe('previewMint');
                expect(wrapper).toBe(pool.tokens[0].address);
                expect(amount).toBe(10_050n * 10n ** 12n);
                return 10_100n;
            },
        );
        mocks.swap.mockImplementation(async (swapInput: SwapInput) => {
            const path = swapInput.paths[0];
            if (path.isBuffer?.some(Boolean)) {
                expect(path.outputAmountRaw).toBe(5_000n);
                throw decodedRevert('AmountGivenZero');
            }
            expect(swapInput.swapKind).toBe(SwapKind.GivenOut);
            expect(path.pools).toEqual([pool.address]);
            expect(path.tokens.map((token) => token.address)).toEqual([
                pool.tokens[0].address,
                pool.tokens[1].address,
            ]);
            expect(path.outputAmountRaw).toBe(
                wrapped[1] ? 5_000n * 10n ** 12n : 5_000n,
            );
            return swapQuote(
                swapInput,
                wrapped[0] ? 10_050n * 10n ** 12n : 10_100n,
            );
        });

        expect((await calculate()).amount).toBe(50_000_000_000_000n);
        expect(input).toEqual(originalInput);
        expect(mocks.swap).toHaveBeenCalledTimes(2);
        for (const [swapInput, rpcUrl, block, querySender] of mocks.swap.mock
            .calls) {
            expect(swapInput.userData).toBe(userData);
            expect(rpcUrl).toBe(input.rpcUrl);
            expect(block).toBeUndefined();
            expect(querySender).toBe(sender);
        }
        expect(mocks.preview.mock.calls.map((call) => call[3])).toEqual([
            ...(wrapped[1] ? ['previewWithdraw'] : []),
            ...(wrapped[0] ? ['previewMint'] : []),
        ]);
    });

    it.each(['zero shares', 'direct pool revert'] as const)(
        'propagates %s from a delta fallback',
        async (failure) => {
            const { calculate, add } = setupRaw('boosted', {
                inputs: [1_000_000n, 1_000_000n],
                deltas: [5_000n, -10_000n],
                decimals: [6, 6],
                wrapperDecimals: [18, 18],
            });
            add.mockRejectedValue(decodedRevert('WrapAmountTooSmall'));
            mocks.preview.mockResolvedValue(
                failure === 'zero shares' ? 0n : 5_000n * 10n ** 12n,
            );
            mocks.add.mockRejectedValue(decodedRevert('TradeAmountTooSmall'));
            await expect(calculate()).rejects.toThrow('Delta add step');
            expect(mocks.add).toHaveBeenCalledTimes(
                failure === 'zero shares' ? 0 : 1,
            );
            expect(mocks.swap).not.toHaveBeenCalled();
        },
    );

    it.each(['zero shares', 'direct pool revert'] as const)(
        'propagates %s from a swap fallback',
        async (failure) => {
            const { calculate } = setupRaw('boosted', {
                inputs: [1_000_000n, 1_000_000n],
                deltas: [10_000n, -5_000n],
                decimals: [6, 6],
                wrapperDecimals: [18, 18],
            });
            mocks.preview.mockResolvedValue(
                failure === 'zero shares' ? 0n : 5_000n * 10n ** 12n,
            );
            mocks.swap.mockImplementation(async (swapInput: SwapInput) => {
                if (swapInput.paths[0].isBuffer?.some(Boolean))
                    throw decodedRevert('WrapAmountTooSmall');
                throw decodedRevert('TradeAmountTooSmall');
            });
            await expect(calculate()).rejects.toThrow('Swap step');
            expect(mocks.preview.mock.calls[0][3]).toBe('previewWithdraw');
            expect(mocks.swap).toHaveBeenCalledTimes(
                failure === 'zero shares' ? 1 : 2,
            );
        },
    );

    it.each(['TradeAmountTooSmall', 'PoolPaused', 'SwapLimit'] as const)(
        'does not use previews for a material %s',
        async (errorName) => {
            const { calculate } = setupRaw('boosted', {
                inputs: [1_000_000n, 1_000_000n],
                deltas: [10_000n, -5_000n],
                decimals: [6, 6],
            });
            mocks.swap.mockRejectedValue(decodedRevert(errorName));
            await expect(calculate()).rejects.toThrow('Swap step');
            expect(mocks.preview).not.toHaveBeenCalled();
        },
    );

    it('does not use previews when neither leg is wrapped', async () => {
        const { calculate } = setupRaw('boosted', {
            inputs: [1_000_000n, 1_000_000n],
            deltas: [10_000n, -5_000n],
            decimals: [6, 6],
            wrapped: [false, false],
        });
        mocks.swap.mockRejectedValue(decodedRevert('AmountGivenZero'));
        await expect(calculate()).rejects.toThrow('Swap step');
        expect(mocks.preview).not.toHaveBeenCalled();
    });

    it('does not use a preview for an unwrapped delta', async () => {
        const { calculate, add } = setupRaw('boosted', {
            inputs: [1_000_000n, 1_000_000n],
            deltas: [5_000n, -10_000n],
            decimals: [6, 6],
            wrapped: [false, true],
        });
        add.mockRejectedValue(decodedRevert('WrapAmountTooSmall'));
        await expect(calculate()).rejects.toThrow('Delta add step');
        expect(mocks.preview).not.toHaveBeenCalled();
        expect(mocks.add).not.toHaveBeenCalled();
    });

    it.each([
        { name: 'input', wrapped: [true, false] },
        { name: 'output', wrapped: [false, true] },
    ])(
        'uses the correct pool slot when the $name underlying is another pool token',
        async ({ name, wrapped }) => {
            const sharedAddress = address(2);
            const { calculate, input, pool } = setupRaw('boosted', {
                // These initial add/remove results are intentionally mocked in pool
                // order. Upstream address-map ambiguity is a separate concern.
                tokenAddresses: [sharedAddress, sharedAddress],
                inputs:
                    name === 'input'
                        ? [0n, 1_000_000n]
                        : [1_000_000n, 1_000_000n],
                deltas:
                    name === 'input' ? [5_000n, -10_000n] : [10_000n, -5_000n],
                decimals: [6, 6],
                wrapped,
                wrapperDecimals: [18, 18],
            });
            const wrappedIndex = name === 'input' ? 0 : 1;
            const wrapper = pool.tokens[wrappedIndex].address;
            mocks.preview.mockImplementation(
                async (
                    rpcUrl: string,
                    previewChainId: number,
                    previewWrapper: Address,
                    functionName: string,
                    amount: bigint,
                ) => {
                    expect([
                        rpcUrl,
                        previewChainId,
                        previewWrapper,
                        amount,
                    ]).toEqual([input.rpcUrl, chainId, wrapper, 5_000n]);
                    expect(functionName).toBe(
                        name === 'input' ? 'previewDeposit' : 'previewWithdraw',
                    );
                    return 5_000n * 10n ** 12n;
                },
            );
            mocks.swap.mockImplementation(async (swapInput: SwapInput) => {
                const path = swapInput.paths[0];
                if (path.pools.length === 2) {
                    expect(path.isBuffer).toEqual(
                        name === 'input' ? [true, false] : [false, true],
                    );
                    expect(path.tokens.map((token) => token.address)).toEqual([
                        sharedAddress,
                        wrapper,
                        sharedAddress,
                    ]);
                    throw decodedRevert('WrapAmountTooSmall');
                }
                expect(path.pools).toEqual([pool.address]);
                expect(path.tokens.map((token) => token.address)).toEqual(
                    name === 'input'
                        ? [wrapper, sharedAddress]
                        : [sharedAddress, wrapper],
                );
                return swapQuote(
                    swapInput,
                    name === 'input' ? 4_700n : 10_100n,
                );
            });

            expect((await calculate()).amount).toBe(
                name === 'input' ? 2_650_000_000_000_000n : 50_000_000_000_000n,
            );
            expect(mocks.preview).toHaveBeenCalledTimes(1);
            expect(mocks.swap).toHaveBeenCalledTimes(2);
        },
    );
});

it('sends a real ERC4626 preview eth_call from the configured Vault', async () => {
    const actual = await vi.importActual<
        typeof import('@/entities/priceImpact/erc4626Preview')
    >('@/entities/priceImpact/erc4626Preview');
    const rpcUrl = 'http://unused.invalid';
    const wrapper = address(200);
    const amount = 5_000n;
    const returnedShares = 5_123n * 10n ** 12n;
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
        expect(url).toBe(new URL(rpcUrl).href);
        const request = JSON.parse(options.body as string);
        expect(request.method).toBe('eth_call');
        expect(request.params[0].to.toLowerCase()).toBe(wrapper.toLowerCase());
        expect(request.params[0].from.toLowerCase()).toBe(
            AddressProvider.Vault(chainId).toLowerCase(),
        );
        expect(request.params[0].data).toBe(
            encodeFunctionData({
                abi: erc4626Abi,
                functionName: 'previewDeposit',
                args: [amount],
            }),
        );
        expect(request.params[1]).toBe('latest');
        return new Response(
            JSON.stringify({
                jsonrpc: '2.0',
                id: request.id,
                result: encodeFunctionResult({
                    abi: erc4626Abi,
                    functionName: 'previewDeposit',
                    result: returnedShares,
                }),
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
        expect(
            await actual.previewErc4626(
                rpcUrl,
                chainId,
                wrapper,
                'previewDeposit',
                amount,
            ),
        ).toBe(returnedShares);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
        vi.unstubAllGlobals();
    }
});
import {
    balancerBatchRouterAbiExtended,
    balancerCompositeLiquidityRouterBoostedAbiExtended,
    balancerRouterAbiExtended,
} from '@/abi';
