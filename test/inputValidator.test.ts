// pnpm test -- inputValidator.test.ts
import {
    AddLiquidityInput,
    AddLiquidityKind,
    PoolState,
    RemoveLiquidityInput,
    RemoveLiquidityKind,
} from '@/entities';
import { InputValidatorGyro } from '@/entities/inputValidator/gyro/inputValidatorGyro';
import { InputValidator } from '@/entities/inputValidator/inputValidator';
import { InputValidatorStable } from '@/entities/inputValidator/stable/inputValidatorStable';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';
import { InputValidatorWeighted } from '@/entities/inputValidator/weighted/inputValidatorWeighted';
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

    test('maps uppercase Frontier API pool types (WEIGHTED, STABLE, ECLP) to concrete validators without warning', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const inputValidator = new InputValidator();

        expect(inputValidator.getValidator('WEIGHTED')).toBeInstanceOf(
            InputValidatorWeighted,
        );
        expect(inputValidator.getValidator('STABLE')).toBeInstanceOf(
            InputValidatorStable,
        );
        expect(inputValidator.getValidator('ECLP')).toBeInstanceOf(
            InputValidatorGyro,
        );
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    test('enforces GyroECLP proportional-only rules for API ECLP pool type', () => {
        const inputValidator = new InputValidator();
        const eclpPoolState: PoolState = {
            id: '0x1111111111111111111111111111111111111111',
            address: '0x1111111111111111111111111111111111111111',
            type: 'ECLP',
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
        }).toThrowError(
            /Add Liquidity Unbalanced not supported for pool type ECLP/,
        );

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
        }).toThrowError(
            /Remove Liquidity SingleTokenExactIn not supported for pool type ECLP/,
        );
    });
});
