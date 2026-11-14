import { InputValidator } from '../inputValidator/inputValidator';
import { PoolState } from '../types';
import {
    InitPoolBuildOutput,
    InitPoolConfig,
    InitPoolInput,
    InitPoolInputV3,
} from './types';
import { InitPoolV3 } from './initPoolV3';
import { Permit2 } from '@/entities/permit2Helper';
import { protocolVersionError } from '@/utils';

export * from './types';

export class InitPool {
    inputValidator: InputValidator = new InputValidator();

    constructor(public config?: InitPoolConfig) {}

    buildCall(input: InitPoolInput, poolState: PoolState): InitPoolBuildOutput {
        if (poolState.protocolVersion !== 3) {
            throw protocolVersionError('Init Pool', poolState.protocolVersion);
        }
        this.inputValidator.validateInitPool(input, poolState);
        return new InitPoolV3().buildCall(input, poolState);
    }

    buildCallWithPermit2(
        input: InitPoolInputV3,
        poolState: PoolState,
        permit2: Permit2,
    ): InitPoolBuildOutput {
        if (poolState.protocolVersion !== 3) {
            throw protocolVersionError('Init Pool', poolState.protocolVersion);
        }
        this.inputValidator.validateInitPool(input, poolState);
        return new InitPoolV3().buildCallWithPermit2(input, poolState, permit2);
    }
}
