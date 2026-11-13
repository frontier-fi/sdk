import { describe, expect, it } from 'vitest';
import { decodeFunctionData, parseEther } from 'viem';
import {
    AddressProvider,
    ChainId,
    NATIVE_ASSETS,
    Slippage,
    Swap,
    SwapKind,
} from '@/index';
import {
    frontierBatchRouterAbiExtended,
    frontierRouterAbiExtended,
} from '@/abi';
import type { Path } from '@/entities/swap';

const other = {
    address: '0x0000000000000000000000000000000000000010',
    decimals: 18,
} as const;
const slippage = Slippage.fromPercentage('1');

const CHAIN_CONFIGS = [
    {
        name: 'Base',
        chainId: ChainId.BASE,
        weth: {
            address: '0x4200000000000000000000000000000000000006',
            decimals: 18,
        } as const,
    },
    {
        name: 'Sepolia',
        chainId: ChainId.SEPOLIA,
        weth: {
            address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
            decimals: 18,
        } as const,
    },
] as const;

describe.each(CHAIN_CONFIGS)(
    'Frontier $name native swap funding',
    ({ chainId, weth }) => {
        it('uses the WETH configured in the deployed routers', () => {
            expect(NATIVE_ASSETS[chainId].wrapped).toBe(weth.address);
        });

        for (const swapKind of [SwapKind.GivenIn, SwapKind.GivenOut]) {
            for (const batch of [false, true]) {
                for (const nativeInput of [false, true]) {
                    it(`funds kind ${swapKind}, batch=${batch}, nativeInput=${nativeInput}`, () => {
                        const path: Path = {
                            protocolVersion: 3,
                            tokens: nativeInput ? [weth, other] : [other, weth],
                            pools: [
                                '0x0000000000000000000000000000000000000020',
                            ],
                            inputAmountRaw: parseEther('2'),
                            outputAmountRaw: parseEther('3'),
                        };
                        const paths = batch ? [path, { ...path }] : [path];
                        const swap = new Swap({ chainId, swapKind, paths });
                        const to = batch
                            ? AddressProvider.BatchRouter(chainId)
                            : AddressProvider.Router(chainId);
                        const pathAmounts = batch
                            ? paths.map((p) =>
                                  swapKind === SwapKind.GivenIn
                                      ? p.outputAmountRaw
                                      : p.inputAmountRaw,
                              )
                            : undefined;
                        const queryOutput =
                            swapKind === SwapKind.GivenIn
                                ? {
                                      to,
                                      swapKind,
                                      amountIn: swap.inputAmount,
                                      expectedAmountOut: swap.outputAmount,
                                      pathAmounts,
                                  }
                                : {
                                      to,
                                      swapKind,
                                      amountOut: swap.outputAmount,
                                      expectedAmountIn: swap.inputAmount,
                                      pathAmounts,
                                  };
                        const input = {
                            queryOutput,
                            slippage,
                            deadline: 10000000000n,
                            wethIsEth: true,
                        };
                        const tx = swap.buildCall(input);
                        const expectedValue = !nativeInput
                            ? 0n
                            : swapKind === SwapKind.GivenIn
                              ? swap.inputAmount.amount
                              : slippage.applyTo(swap.inputAmount.amount);

                        expect(tx.to).toBe(to);
                        expect(tx.value).toBe(expectedValue);
                        const decoded = decodeFunctionData({
                            abi: batch
                                ? frontierBatchRouterAbiExtended
                                : frontierRouterAbiExtended,
                            data: tx.callData,
                        });
                        expect(decoded.functionName).toBe(
                            batch
                                ? swapKind === SwapKind.GivenIn
                                    ? 'swapExactIn'
                                    : 'swapExactOut'
                                : swapKind === SwapKind.GivenIn
                                  ? 'swapSingleTokenExactIn'
                                  : 'swapSingleTokenExactOut',
                        );
                        expect(decoded.args?.at(-2)).toBe(true);
                        expect(
                            swap.buildCall({ ...input, wethIsEth: false })
                                .value,
                        ).toBe(0n);
                    });
                }
            }
        }
    },
);
