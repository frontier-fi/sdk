import { InputValidatorBase } from '../inputValidatorBase';
import { validateCreatePoolTokens } from '../utils/validateTokens';
import { validateCreatePoolTokenConfig } from '../utils/validateCreatePoolTokenConfig';

import { inputValidationError } from '@/utils';
import { CreatePoolGyroECLPInput } from '@/entities/createPool';
import { GyroECLPMath } from '@frontier-fi/maths';

export class InputValidatorGyro extends InputValidatorBase {
    validateCreatePool(input: CreatePoolGyroECLPInput) {
        validateCreatePoolTokenConfig(input);
        validateCreatePoolTokens(input.tokens);

        if (input.tokens.length !== 2) {
            throw inputValidationError(
                'Create Pool',
                'GyroECLP pools support only two tokens on Frontier v3',
            );
        }

        const { eclpParams } = input;

        try {
            GyroECLPMath.validateParams(eclpParams);
        } catch (err) {
            throw inputValidationError(
                'Create Pool',
                'Invalid base ECLP parameters',
                (err as Error).message,
            );
        }
    }
}
