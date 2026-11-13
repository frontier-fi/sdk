import { InputValidator } from '../inputValidator/inputValidator';
import {
    CreatePoolBase,
    CreatePoolBuildCallOutput,
    CreatePoolInput,
} from './types';
import { CreatePoolV3 } from './createPoolV3';
import { protocolVersionError } from '@/utils';

export * from './types';
export * from './createPoolV3/gyroECLP/createPoolGyroECLP';

export class CreatePool implements CreatePoolBase {
    private readonly inputValidator: InputValidator;

    constructor() {
        this.inputValidator = new InputValidator();
    }

    public buildCall(input: CreatePoolInput): CreatePoolBuildCallOutput {
        if (input.protocolVersion !== 3) {
            throw protocolVersionError('Create Pool', input.protocolVersion);
        }
        this.inputValidator.validateCreatePool(input);
        return new CreatePoolV3().buildCall(input);
    }
}
