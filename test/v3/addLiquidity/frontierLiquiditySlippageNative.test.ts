import { decodeFunctionData, getAddress } from 'viem';
import { routerAbi_V3 } from '@/abi/v3/router';
import { AddLiquidityV3 } from '@/entities/addLiquidity/addLiquidityV3';
import {
    AddLiquidityKind,
    AddLiquidityV3BuildCallInput,
} from '@/entities/addLiquidity/types';
import { Permit2Helper } from '@/entities/permit2Helper';
import { Slippage } from '@/entities/slippage';
import { Token } from '@/entities/token';
import { TokenAmount } from '@/entities/tokenAmount';
import { PublicWalletClient } from '@/utils';

const chainId = 11155111;
const router = '0xb3c45499aa0ad2ff5d586e7d473c75d5781c557b';
const pool = '0x0000000000000000000000000000000000000010';
const owner = '0x0000000000000000000000000000000000000020';
const wethAddress = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';
const unit = 10n ** 18n;

function buildInput(
    kind: AddLiquidityKind,
    tokenInIndex = 1,
): AddLiquidityV3BuildCallInput {
    const tokens = [
        new Token(chainId, '0x0000000000000000000000000000000000000001', 6),
        new Token(chainId, wethAddress, 18),
    ];
    const quotes = [2_000_000n, unit];
    return {
        chainId,
        protocolVersion: 3,
        poolId: pool,
        poolType: 'WEIGHTED',
        to: router,
        addLiquidityKind: kind,
        tokenInIndex:
            kind === AddLiquidityKind.SingleToken ? tokenInIndex : undefined,
        amountsIn: tokens.map((token, i) =>
            TokenAmount.fromRawAmount(
                token,
                kind === AddLiquidityKind.SingleToken && i !== tokenInIndex
                    ? 0n
                    : quotes[i],
            ),
        ),
        bptOut: TokenAmount.fromRawAmount(
            new Token(chainId, pool, 18),
            10n * unit,
        ),
        slippage: Slippage.fromPercentage('1'),
        wethIsEth: true,
        userData: '0x1234',
    };
}

function freeze<T>(value: T): T {
    if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}

// Decode with the Router ABI matching the 20261019-router deployment.
describe('Frontier V3 liquidity slippage and native funding', () => {
    const builder = new AddLiquidityV3();

    test.each([0, 1])(
        'single-token exact-BPT-out uses the maximum at token index %i',
        (tokenInIndex) => {
            const input = buildInput(
                AddLiquidityKind.SingleToken,
                tokenInIndex,
            );
            const result = builder.buildCall(input);
            const expectedMax =
                tokenInIndex === 0 ? 2_020_000n : (101n * unit) / 100n;

            expect(
                decodeFunctionData({
                    abi: routerAbi_V3,
                    data: result.callData,
                }),
            ).toEqual({
                functionName: 'addLiquiditySingleTokenExactOut',
                args: [
                    pool,
                    getAddress(input.amountsIn[tokenInIndex].token.address),
                    expectedMax,
                    10n * unit,
                    true,
                    input.userData,
                ],
            });
            expect(result.maxAmountsIn[tokenInIndex].amount).toBe(expectedMax);
            expect(result.maxAmountsIn[1 - tokenInIndex].amount).toBe(0n);
            expect(result.minBptOut.amount).toBe(10n * unit);
            expect(result.value).toBe(tokenInIndex === 1 ? expectedMax : 0n);
        },
    );

    test.each([
        ['1', 2_020_000n, (101n * unit) / 100n],
        ['0', 2_000_000n, unit],
    ] as const)(
        'proportional native funding matches calldata at %s%% slippage',
        (percentage, tokenMax, nativeMax) => {
            const input = buildInput(AddLiquidityKind.Proportional);
            input.slippage = Slippage.fromPercentage(percentage);
            const result = builder.buildCall(input);

            expect(
                decodeFunctionData({
                    abi: routerAbi_V3,
                    data: result.callData,
                }),
            ).toEqual({
                functionName: 'addLiquidityProportional',
                args: [pool, [tokenMax, nativeMax], 10n * unit, true, '0x1234'],
            });
            expect(result.maxAmountsIn.map((amount) => amount.amount)).toEqual([
                tokenMax,
                nativeMax,
            ]);
            expect(result.value).toBe(nativeMax);
        },
    );

    test('unbalanced adds keep exact inputs and apply slippage to BPT', () => {
        const input = buildInput(AddLiquidityKind.Unbalanced);
        const result = builder.buildCall(input);

        expect(
            decodeFunctionData({ abi: routerAbi_V3, data: result.callData }),
        ).toEqual({
            functionName: 'addLiquidityUnbalanced',
            args: [
                pool,
                [2_000_000n, unit],
                (99n * unit) / 10n,
                true,
                '0x1234',
            ],
        });
        expect(result.maxAmountsIn.map((amount) => amount.amount)).toEqual([
            2_000_000n,
            unit,
        ]);
        expect(result.minBptOut.amount).toBe((99n * unit) / 10n);
        expect(result.value).toBe(unit);
    });

    test.each([
        AddLiquidityKind.SingleToken,
        AddLiquidityKind.Proportional,
        AddLiquidityKind.Unbalanced,
    ])('ERC20-funded %s adds attach no ETH', (kind) => {
        const input = buildInput(kind);
        input.wethIsEth = false;
        expect(builder.buildCall(input).value).toBe(0n);
    });

    test.each([
        AddLiquidityKind.SingleToken,
        AddLiquidityKind.Proportional,
        AddLiquidityKind.Unbalanced,
    ])('%s permits and repeated builds preserve inputs', async (kind) => {
        const input = freeze(buildInput(kind));
        const original = structuredClone(input);
        const client = {
            getChainId: vi.fn().mockResolvedValue(chainId),
            signTypedData: vi.fn().mockResolvedValue('0x1234'),
        } as unknown as PublicWalletClient;
        const permit = freeze(
            await Permit2Helper.signAddLiquidityApproval({
                ...input,
                client,
                owner,
                nonces: [0, 0],
                expirations: [2_000_000_000, 2_000_000_000],
            }),
        );
        const result = builder.buildCall(input);
        const wrapped = builder.buildCallWithPermit2(input, permit);
        const decoded = decodeFunctionData({
            abi: routerAbi_V3,
            data: wrapped.callData,
        });

        expect(permit.batch.spender.toLowerCase()).toBe(router);
        expect(permit.batch.details.map((detail) => detail.amount)).toEqual(
            result.maxAmountsIn.map((amount) => amount.amount),
        );
        expect(decoded.functionName).toBe('permitBatchAndCall');
        if (decoded.functionName !== 'permitBatchAndCall') {
            throw new Error('Unexpected call');
        }
        expect(decoded.args[4]).toEqual([result.callData]);
        expect(wrapped.value).toBe(result.value);
        expect(wrapped.maxAmountsIn).toEqual(result.maxAmountsIn);
        expect(builder.buildCall(input)).toEqual(result);
        expect(builder.buildCallWithPermit2(input, permit)).toEqual(wrapped);
        expect(structuredClone(input)).toEqual(original);
    });
});
