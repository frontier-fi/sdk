import {
    AddLiquidityKind,
    AddLiquidityUnbalancedInput,
} from '@/entities/addLiquidity/types';
import { AddLiquidityNestedInputV2 } from '@/entities/addLiquidityNested/addLiquidityNestedV2/types';
import { AddLiquidityNestedInputV3 } from '@/entities/addLiquidityNested/addLiquidityNestedV3/types';
import { PriceImpact } from '@/entities/priceImpact';
import { Token } from '@/entities/token';
import { TokenAmount } from '@/entities/tokenAmount';
import {
    NestedPoolStateV2,
    NestedPoolStateV3,
    PoolState,
} from '@/entities/types';
import { Address, PoolType } from '@/types';
import { ChainId } from '@/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    boostedAdd: vi.fn(),
    boostedRemove: vi.fn(),
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

const chainId = ChainId.SEPOLIA;
const rpcUrl = 'http://unused.invalid';
const address = (id: number): Address =>
    `0x${id.toString(16).padStart(40, '0')}`;
const sender = address(90);
const userData = '0x1234' as const;
const childBpt = new Token(chainId, address(100), 18);
const parentBpt = new Token(chainId, address(200), 18);
const childBptOut = TokenAmount.fromRawAmount(childBpt, 50n);

function fixture(childBoosted: boolean, parentBoosted: boolean) {
    const childToken = {
        address: address(1),
        decimals: 18,
        index: 0,
        underlyingToken: childBoosted
            ? { address: address(11), decimals: 18, index: 0 }
            : null,
    };
    const parentToken = {
        address: address(2),
        decimals: 18,
        index: 1,
        underlyingToken: parentBoosted
            ? { address: address(12), decimals: 18, index: 1 }
            : null,
    };
    const state: NestedPoolStateV3 = {
        protocolVersion: 3,
        mainTokens: [
            childToken.underlyingToken ?? childToken,
            parentToken.underlyingToken ?? parentToken,
        ],
        pools: [
            {
                id: parentBpt.address,
                address: parentBpt.address,
                type: PoolType.Weighted,
                level: 1,
                tokens: [
                    {
                        address: childBpt.address,
                        decimals: 18,
                        index: 0,
                        underlyingToken: null,
                    },
                    parentToken,
                ],
            },
            {
                id: childBpt.address,
                address: childBpt.address,
                type: PoolType.Weighted,
                level: 0,
                tokens: [childToken],
            },
        ],
    };
    const input: AddLiquidityNestedInputV3 = {
        chainId,
        rpcUrl,
        amountsIn: state.mainTokens.map((t, i) => ({
            address: t.address,
            decimals: t.decimals,
            rawAmount: i === 0 ? 100n : 200n,
        })),
    };
    return { input, state };
}

beforeEach(() => {
    vi.resetAllMocks();
    const amountsByPool = new Map<Address, TokenAmount[]>();
    const add = async (input: AddLiquidityUnbalancedInput, pool: PoolState) => {
        const amountsIn = input.amountsIn.map((a) =>
            TokenAmount.fromRawAmount(
                new Token(chainId, a.address, a.decimals),
                a.rawAmount,
            ),
        );
        amountsByPool.set(pool.address, amountsIn);
        return {
            amountsIn,
            bptOut:
                pool.address === childBpt.address
                    ? childBptOut
                    : TokenAmount.fromRawAmount(parentBpt, 75n),
        };
    };
    const remove = async (_input: unknown, pool: PoolState) => ({
        amountsOut: amountsByPool.get(pool.address),
    });
    mocks.add.mockImplementation(add);
    mocks.boostedAdd.mockImplementation(add);
    mocks.remove.mockImplementation(remove);
    mocks.boostedRemove.mockImplementation(remove);
});

describe.each([
    { childBoosted: false, parentBoosted: false },
    { childBoosted: true, parentBoosted: false },
    { childBoosted: false, parentBoosted: true },
    { childBoosted: true, parentBoosted: true },
])(
    'nested query context (boosted child: $childBoosted, parent: $parentBoosted)',
    ({ childBoosted, parentBoosted }) => {
        it.each([
            { name: 'both fields', context: { sender, userData } },
            { name: 'sender only', context: { sender } },
            { name: 'userData only', context: { userData } },
            { name: 'anonymous defaults', context: {} },
        ])(
            'forwards $name through every level and BPT quote',
            async ({ context }) => {
                const { input, state } = fixture(childBoosted, parentBoosted);
                Object.assign(input, context);
                const originalInput = structuredClone(input);

                expect(
                    (await PriceImpact.addLiquidityNested(input, state)).amount,
                ).toBe(0n);

                const calls = [
                    ...mocks.add.mock.calls,
                    ...mocks.boostedAdd.mock.calls,
                ];
                // Each level makes an initial ABA add query and a separate BPT
                // quote whose output supplies the parent's amountsIn.
                expect(calls).toHaveLength(4);
                for (const [level, bpt, boosted] of [
                    [0, childBpt, childBoosted],
                    [1, parentBpt, parentBoosted],
                ] as const) {
                    const add = boosted ? mocks.boostedAdd : mocks.add;
                    const levelCalls = add.mock.calls.filter(
                        ([, pool]) => pool.address === bpt.address,
                    );
                    expect(levelCalls).toHaveLength(2);
                    for (const [queryInput, pool] of levelCalls) {
                        expect(queryInput).toEqual({
                            chainId,
                            rpcUrl,
                            kind: AddLiquidityKind.Unbalanced,
                            sender: input.sender,
                            userData: input.userData,
                            amountsIn:
                                level === 0
                                    ? [input.amountsIn[0]]
                                    : [
                                          childBptOut.toInputAmount(),
                                          input.amountsIn[1],
                                      ],
                        });
                        expect(pool.protocolVersion).toBe(3);
                    }
                }
                const reverseCalls = [
                    ...mocks.remove.mock.calls,
                    ...mocks.boostedRemove.mock.calls,
                ];
                expect(reverseCalls).toHaveLength(2);
                for (const [queryInput] of reverseCalls) {
                    expect(queryInput.sender).toBe(input.sender);
                    expect(queryInput.userData).toBe(input.userData);
                }
                expect(input).toEqual(originalInput);
            },
        );
    },
);

it('accepts an existing V2 input without V3 context fields', async () => {
    const { input, state } = fixture(false, false);
    const v2Input: AddLiquidityNestedInputV2 = {
        ...input,
        fromInternalBalance: true,
    };
    const v2State: NestedPoolStateV2 = {
        ...state,
        protocolVersion: 2,
        pools: state.pools.map((pool) => ({
            ...pool,
            type: PoolType.Weighted,
            tokens: pool.tokens.map(({ underlyingToken, ...token }) => token),
        })),
    };

    expect(
        (await PriceImpact.addLiquidityNested(v2Input, v2State)).amount,
    ).toBe(0n);

    expect(mocks.add).toHaveBeenCalledTimes(4);
    expect(mocks.boostedAdd).not.toHaveBeenCalled();
    for (const [queryInput, pool] of mocks.add.mock.calls) {
        expect(queryInput.sender).toBeUndefined();
        expect(queryInput.userData).toBeUndefined();
        expect(pool.protocolVersion).toBe(2);
    }
});
