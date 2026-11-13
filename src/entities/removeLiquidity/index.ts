import {
    RemoveLiquidityBase,
    RemoveLiquidityConfig,
    RemoveLiquidityInput,
    RemoveLiquidityQueryOutput,
    RemoveLiquidityBuildCallOutput,
    RemoveLiquidityV3BuildCallInput,
} from './types';
import { PoolState } from '../types';
import { InputValidator } from '../inputValidator/inputValidator';
import { RemoveLiquidityV3 } from './removeLiquidityV3';
import { Permit } from '../permitHelper';
import {
    exceedingParameterError,
    missingParameterError,
    protocolVersionError,
} from '@/utils';

export class RemoveLiquidity implements RemoveLiquidityBase {
    private readonly inputValidator: InputValidator = new InputValidator();

    constructor(public config?: RemoveLiquidityConfig) {}

    public async query(
        input: RemoveLiquidityInput,
        poolState: PoolState,
        block?: bigint,
    ): Promise<RemoveLiquidityQueryOutput> {
        if (poolState.protocolVersion !== 3) {
            throw protocolVersionError(
                'Remove Liquidity',
                poolState.protocolVersion,
            );
        }
        this.inputValidator.validateRemoveLiquidity(input, poolState);
        const removeLiquidity = new RemoveLiquidityV3();
        return removeLiquidity.query(input, poolState, block);
    }

    public buildCall(
        input: RemoveLiquidityV3BuildCallInput,
    ): RemoveLiquidityBuildCallOutput {
        if (input.protocolVersion !== 3) {
            throw protocolVersionError(
                'Remove Liquidity buildCall',
                input.protocolVersion,
            );
        }
        if (!('userData' in input)) {
            throw missingParameterError(
                'Remove Liquidity buildCall',
                'userData',
                3,
            );
        }
        if ('sender' in input || 'recipient' in input) {
            throw exceedingParameterError(
                'Remove Liquidity buildCall',
                'sender or recipient',
                input.protocolVersion,
            );
        }
        const removeLiquidity = new RemoveLiquidityV3();
        return removeLiquidity.buildCall(input);
    }

    public buildCallWithPermit(
        input: RemoveLiquidityV3BuildCallInput,
        permit: Permit,
    ): RemoveLiquidityBuildCallOutput {
        if (input.protocolVersion !== 3) {
            throw protocolVersionError(
                'Remove Liquidity buildCallWithPermit',
                input.protocolVersion,
            );
        }

        if (!('userData' in input)) {
            throw missingParameterError(
                'Remove Liquidity buildCallWithPermit',
                'userData',
                3,
            );
        }

        const removeLiquidity = new RemoveLiquidityV3();
        return removeLiquidity.buildCallWithPermit(input, permit);
    }
}
