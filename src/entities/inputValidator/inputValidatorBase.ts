import {
    RemoveLiquidityInput,
    RemoveLiquidityRecoveryInput,
} from '@/entities/removeLiquidity/types';
import { InitPoolInput } from '../initPool/types';
import { CreatePoolInput } from '../createPool/types';
import { PoolState, PoolStateWithUnderlyings } from '../types';
import {
    validateTokensAddLiquidity,
    validateTokensAddLiquidityBoosted,
    validateTokensRemoveLiquidity,
    validateTokensRemoveLiquidityRecovery,
} from './utils/validateTokens';
import { AddLiquidityInput } from '@/entities/addLiquidity/types';
import { areTokensInArray } from '@/entities/utils/areTokensInArray';
import { isSameAddress, NATIVE_ASSETS, inputValidationError } from '@/utils';
import { AddLiquidityBoostedInput } from '../addLiquidityBoosted/types';

export class InputValidatorBase {
    validateInitPool(initPoolInput: InitPoolInput, poolState: PoolState): void {
        areTokensInArray(
            'Init Pool',
            initPoolInput.amountsIn.map((a) => a.address),
            poolState.tokens.map((t) => t.address),
        );
        this.validateWethIsEth(initPoolInput);
    }

    validateCreatePool(_input: CreatePoolInput) {}

    validateAddLiquidity(
        addLiquidityInput: AddLiquidityInput,
        poolState: PoolState,
    ): void {
        validateTokensAddLiquidity(addLiquidityInput, poolState);
    }

    validateRemoveLiquidity(
        input: RemoveLiquidityInput,
        poolState: PoolState,
    ): void {
        validateTokensRemoveLiquidity(input, poolState);
    }

    validateRemoveLiquidityRecovery(
        input: RemoveLiquidityRecoveryInput,
        poolState: PoolState,
    ): void {
        validateTokensRemoveLiquidityRecovery(input, poolState);
    }

    validateWethIsEth(initPoolInput: InitPoolInput) {
        if (initPoolInput.wethIsEth) {
            const inputContainsWrappedNativeAsset =
                initPoolInput.amountsIn.some((a) =>
                    isSameAddress(
                        a.address,
                        NATIVE_ASSETS[initPoolInput.chainId].wrapped,
                    ),
                );
            if (!inputContainsWrappedNativeAsset) {
                throw inputValidationError(
                    'Init Pool',
                    'wethIsEth requires wrapped native asset as input',
                );
            }
        }
    }

    validateAddLiquidityBoosted(
        addLiquidityInput: AddLiquidityBoostedInput,
        poolState: PoolStateWithUnderlyings,
    ): void {
        validateTokensAddLiquidityBoosted(addLiquidityInput, poolState);
    }
}
