import { AddLiquidityInput } from '@/entities/addLiquidity/types';
import { PoolState } from '@/entities/types';
import { inputValidationError, STABLE_POOL_CONSTRAINTS } from '@/utils';
import { InputValidatorBase } from '../inputValidatorBase';
import {
    validateCreatePoolTokens,
    validateTokensAddLiquidity,
} from '../utils/validateTokens';
import { CreatePoolV3StableInput } from '@/entities/createPool';
import { validateCreatePoolTokenConfig } from '../utils/validateCreatePoolTokenConfig';

const { MAX_TOKENS, MIN_AMP, MAX_AMP } = STABLE_POOL_CONSTRAINTS;

export class InputValidatorStable extends InputValidatorBase {
    validateCreatePool(input: CreatePoolV3StableInput) {
        validateCreatePoolTokens(input.tokens);
        validateCreatePoolTokenConfig(input);

        if (input.tokens.length > MAX_TOKENS) {
            throw inputValidationError(
                'Create Pool',
                `Stable pools can only have a maximum of ${MAX_TOKENS} tokens on Frontier v3`,
            );
        }
        if (input.amplificationParameter < MIN_AMP) {
            throw inputValidationError(
                'Create Pool',
                `Amplification parameter below minimum of ${MIN_AMP} on Frontier v3`,
            );
        }
        if (input.amplificationParameter > MAX_AMP) {
            throw inputValidationError(
                'Create Pool',
                `Amplification parameter above maximum of ${MAX_AMP} on Frontier v3`,
            );
        }
    }

    validateAddLiquidity(
        addLiquidityInput: AddLiquidityInput,
        poolState: PoolState,
    ): void {
        validateTokensAddLiquidity(addLiquidityInput, poolState);
    }
}
