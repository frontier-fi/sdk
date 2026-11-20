// pnpm test -- inputValidator.test.ts
import {
    AddLiquidity,
    AddLiquidityBuildCallInput,
    AddLiquidityInput,
    AddLiquidityKind,
    PoolState,
    RemoveLiquidity,
    RemoveLiquidityInput,
    RemoveLiquidityKind,
    RemoveLiquidityV3BuildCallInput,
    Slippage,
    Swap,
    SwapBuildCallInput,
    Token,
    TokenAmount,
} from '@/entities';
import { InputValidatorGyro } from '@/entities/inputValidator/gyro/inputValidatorGyro';
import { InputValidator } from '@/entities/inputValidator/inputValidator';
import { InputValidatorStable } from '@/entities/inputValidator/stable/inputValidatorStable';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';
import { InputValidatorWeighted } from '@/entities/inputValidator/weighted/inputValidatorWeighted';
import { SwapKind } from '@/types';
import { exceedingParameterError } from '@/utils';
import { ChainId } from '@/utils/constants';
import { describe, expect, test, vi } from 'vitest';

describe('inputValidator', () => {
    test('should throw when unsupported chain', () => {
        const inputValidator = new InputValidator();
        const addLiqInput = {
            chainId: 777777777,
        } as AddLiquidityInput;
        const poolState = {} as PoolState;

        expect(() => {
            inputValidator.validateAddLiquidity(addLiqInput, poolState);
        }).toThrowError(/^Unsupported chainId: 777777777$/);
    });

    test('BatchRouter should return address for MAINNET (chainId 1)', () => {
        expect(() => {
            const address = AddressProvider.BatchRouter(ChainId.MAINNET);
            expect(address).toBeDefined();
        }).not.toThrow();
    });

    test('BatchRouter should return address for BASE (chainId 8453)', () => {
        expect(() => {
            const address = AddressProvider.BatchRouter(ChainId.BASE);
            expect(address).toBeDefined();
        }).not.toThrow();
    });

    test('BatchRouter should return address for SEPOLIA (chainId 11155111)', () => {
        expect(() => {
            const address = AddressProvider.BatchRouter(ChainId.SEPOLIA);
            expect(address).toBeDefined();
        }).not.toThrow();
    });

    test('BatchRouter should throw for non-existent chainId (chainId 2)', () => {
        expect(() => {
            AddressProvider.BatchRouter(2 as ChainId);
        }).toThrowError(/Address not found for BatchRouter on chainId: 2/);
    });

    test('maps uppercase Frontier API pool types (WEIGHTED, STABLE, GYROE) to concrete validators without warning', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const inputValidator = new InputValidator();

        expect(inputValidator.getValidator('WEIGHTED')).toBeInstanceOf(
            InputValidatorWeighted,
        );
        expect(inputValidator.getValidator('STABLE')).toBeInstanceOf(
            InputValidatorStable,
        );
        expect(inputValidator.getValidator('GYROE')).toBeInstanceOf(
            InputValidatorGyro,
        );
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    test('supports recovery, unbalanced add, and single-token remove for GyroE and API GYROE pools while validating pool tokens', async () => {
        const inputValidator = new InputValidator();
        const removeLiquidity = new RemoveLiquidity();

        for (const poolType of ['GYROE', 'GyroE'] as const) {
            const eclpPoolState: PoolState = {
                id: '0x1111111111111111111111111111111111111111',
                address: '0x1111111111111111111111111111111111111111',
                type: poolType,
                protocolVersion: 3,
                tokens: [
                    {
                        address: '0x2222222222222222222222222222222222222222',
                        decimals: 18,
                        index: 0,
                    },
                    {
                        address: '0x3333333333333333333333333333333333333333',
                        decimals: 6,
                        index: 1,
                    },
                ],
            };

            const recoveryInput: RemoveLiquidityInput = {
                chainId: ChainId.SEPOLIA,
                rpcUrl: 'https://rpc.sepolia.org',
                kind: RemoveLiquidityKind.Recovery,
                bptIn: {
                    address: eclpPoolState.address,
                    decimals: 18,
                    rawAmount: 1000n,
                },
            };

            expect(() => {
                inputValidator.validateRemoveLiquidity(
                    recoveryInput,
                    eclpPoolState,
                );
            }).not.toThrow();

            const wrongBptRecoveryInput: RemoveLiquidityInput = {
                ...recoveryInput,
                bptIn: {
                    address: '0x9999999999999999999999999999999999999999',
                    decimals: 18,
                    rawAmount: 1000n,
                },
            };

            expect(() => {
                inputValidator.validateRemoveLiquidity(
                    wrongBptRecoveryInput,
                    eclpPoolState,
                );
            }).toThrowError(/not found in array/);

            await expect(
                removeLiquidity.query(wrongBptRecoveryInput, eclpPoolState),
            ).rejects.toThrowError(/not found in array/);

            const unbalancedAddInput: AddLiquidityInput = {
                chainId: ChainId.SEPOLIA,
                rpcUrl: 'https://rpc.sepolia.org',
                kind: AddLiquidityKind.Unbalanced,
                amountsIn: [
                    {
                        address: '0x2222222222222222222222222222222222222222',
                        decimals: 18,
                        rawAmount: 1000n,
                    },
                ],
            };

            expect(() => {
                inputValidator.validateAddLiquidity(
                    unbalancedAddInput,
                    eclpPoolState,
                );
            }).not.toThrow();

            const singleTokenRemoveInput: RemoveLiquidityInput = {
                chainId: ChainId.SEPOLIA,
                rpcUrl: 'https://rpc.sepolia.org',
                kind: RemoveLiquidityKind.SingleTokenExactIn,
                bptIn: {
                    address: eclpPoolState.address,
                    decimals: 18,
                    rawAmount: 1000n,
                },
                tokenOut: '0x2222222222222222222222222222222222222222',
            };

            expect(() => {
                inputValidator.validateRemoveLiquidity(
                    singleTokenRemoveInput,
                    eclpPoolState,
                );
            }).not.toThrow();

            const invalidTokenRemoveInput: RemoveLiquidityInput = {
                ...singleTokenRemoveInput,
                tokenOut: '0x9999999999999999999999999999999999999999',
            };

            expect(() => {
                inputValidator.validateRemoveLiquidity(
                    invalidTokenRemoveInput,
                    eclpPoolState,
                );
            }).toThrowError(/not found in array/);
        }
    });

    test('rejects sender and recipient on V3 Swap, AddLiquidity, and RemoveLiquidity buildCall methods', () => {
        const tokenA = new Token(
            ChainId.SEPOLIA,
            '0x2222222222222222222222222222222222222222',
            18,
        );
        const tokenB = new Token(
            ChainId.SEPOLIA,
            '0x3333333333333333333333333333333333333333',
            6,
        );
        const bpt = new Token(
            ChainId.SEPOLIA,
            '0x1111111111111111111111111111111111111111',
            18,
        );
        const slippage = Slippage.fromPercentage('0.1');
        const recipient = '0x9999999999999999999999999999999999999999';

        const swap = new Swap({
            chainId: ChainId.SEPOLIA,
            paths: [
                {
                    protocolVersion: 3,
                    tokens: [
                        { address: tokenA.address, decimals: tokenA.decimals },
                        { address: tokenB.address, decimals: tokenB.decimals },
                    ],
                    pools: [bpt.address],
                    inputAmountRaw: 1000n,
                    outputAmountRaw: 1000n,
                },
            ],
            swapKind: SwapKind.GivenIn,
        });
        const swapInput = {
            slippage,
            queryOutput: {
                swapKind: SwapKind.GivenIn as const,
                amountIn: TokenAmount.fromRawAmount(tokenA, 1000n),
                expectedAmountOut: TokenAmount.fromRawAmount(tokenB, 1000n),
                to: AddressProvider.Router(ChainId.SEPOLIA),
            },
            recipient,
        } as unknown as SwapBuildCallInput;

        expect(() => swap.buildCall(swapInput)).toThrowError(
            exceedingParameterError('Swap', 'sender/recipient', 3),
        );

        const addLiquidity = new AddLiquidity();
        const addCallInput = {
            poolType: 'Weighted',
            poolId: bpt.address,
            addLiquidityKind: AddLiquidityKind.Unbalanced,
            bptOut: TokenAmount.fromRawAmount(bpt, 1000n),
            amountsIn: [TokenAmount.fromRawAmount(tokenA, 1000n)],
            chainId: ChainId.SEPOLIA,
            protocolVersion: 3 as const,
            to: AddressProvider.Router(ChainId.SEPOLIA),
            slippage,
            userData: '0x' as const,
            recipient,
        } as unknown as AddLiquidityBuildCallInput;

        expect(() => addLiquidity.buildCall(addCallInput)).toThrowError(
            exceedingParameterError(
                'Add Liquidity Build Call',
                'sender or recipient',
                3,
            ),
        );

        const removeLiquidity = new RemoveLiquidity();
        const removeCallInput = {
            poolType: 'Weighted',
            poolId: bpt.address,
            removeLiquidityKind: RemoveLiquidityKind.Proportional,
            bptIn: TokenAmount.fromRawAmount(bpt, 1000n),
            amountsOut: [TokenAmount.fromRawAmount(tokenA, 1000n)],
            chainId: ChainId.SEPOLIA,
            protocolVersion: 3 as const,
            to: AddressProvider.Router(ChainId.SEPOLIA),
            slippage,
            userData: '0x' as const,
            recipient,
        } as unknown as RemoveLiquidityV3BuildCallInput;

        expect(() => removeLiquidity.buildCall(removeCallInput)).toThrowError(
            exceedingParameterError(
                'Remove Liquidity buildCall',
                'sender or recipient',
                3,
            ),
        );
    });
});
