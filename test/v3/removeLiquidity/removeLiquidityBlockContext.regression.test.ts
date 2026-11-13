import { RemoveLiquidity } from '@/entities/removeLiquidity';
import { RemoveLiquidityV3 } from '@/entities/removeLiquidity/removeLiquidityV3';
import {
    RemoveLiquidityInput,
    RemoveLiquidityKind,
} from '@/entities/removeLiquidity/types';
import { PoolState } from '@/entities/types';
import { Address, PoolType } from '@/types';
import { ChainId } from '@/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { simulateContract } = vi.hoisted(() => ({
    simulateContract: vi.fn(),
}));

vi.mock('viem', async (importOriginal) => ({
    ...(await importOriginal<typeof import('viem')>()),
    createPublicClient: vi.fn(() => ({ simulateContract })),
}));

const address = (id: number): Address =>
    `0x${id.toString(16).padStart(40, '0')}`;
const pool: PoolState = {
    id: address(100),
    address: address(100),
    type: PoolType.Weighted,
    protocolVersion: 3,
    tokens: [
        { address: address(1), decimals: 18, index: 0 },
        { address: address(2), decimals: 18, index: 1 },
    ],
};
const bptIn = { address: pool.address, decimals: 18, rawAmount: 100n };
const sender = address(90);
const userData = '0x1234' as const;
const inputs: RemoveLiquidityInput[] = (
    [
        {
            kind: RemoveLiquidityKind.Proportional,
            bptIn,
        },
        {
            kind: RemoveLiquidityKind.SingleTokenExactIn,
            bptIn,
            tokenOut: address(1),
        },
        {
            kind: RemoveLiquidityKind.SingleTokenExactOut,
            amountOut: { address: address(1), decimals: 18, rawAmount: 10n },
        },
        {
            kind: RemoveLiquidityKind.Recovery,
            bptIn,
        },
    ] as const
).map((input) => ({
    ...input,
    chainId: ChainId.SEPOLIA,
    rpcUrl: 'http://unused.invalid',
    sender,
    userData,
}));

beforeEach(() => {
    simulateContract.mockReset();
    simulateContract.mockImplementation(async ({ functionName }) => ({
        result:
            functionName === 'queryRemoveLiquidityProportional' ||
            functionName === 'queryRemoveLiquidityRecovery'
                ? [10n, 20n]
                : 10n,
    }));
});

describe.each([
    ['direct V3', () => new RemoveLiquidityV3()],
    ['public wrapper', () => new RemoveLiquidity()],
] as const)('remove-liquidity block context through %s', (_, create) => {
    describe.each(inputs)('$kind', (baseInput) => {
        it.each([
            { name: 'input block', inputBlock: 123n, expected: 123n },
            { name: 'zero input block', inputBlock: 0n, expected: 0n },
            {
                name: 'explicit override',
                inputBlock: 123n,
                override: 456n,
                expected: 456n,
            },
            {
                name: 'zero override',
                inputBlock: 123n,
                override: 0n,
                expected: 0n,
            },
            { name: 'argument only', override: 456n, expected: 456n },
            { name: 'latest default', expected: undefined },
        ])('forwards $name to the RPC simulation', async (testCase) => {
            const input = { ...baseInput, block: testCase.inputBlock };
            const original = structuredClone(input);

            await create().query(input, pool, testCase.override);

            expect(simulateContract).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    functionName: `queryRemoveLiquidity${input.kind}`,
                    blockNumber: testCase.expected,
                }),
            );
            if (input.kind !== RemoveLiquidityKind.Recovery) {
                expect(
                    simulateContract.mock.calls[0][0].args.slice(-2),
                ).toEqual([sender, userData]);
            }
            expect(input).toEqual(original);
        });

        it('defaults an omitted third argument to input.block', async () => {
            await create().query({ ...baseInput, block: 123n }, pool);

            expect(simulateContract).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ blockNumber: 123n }),
            );
        });
    });
});
