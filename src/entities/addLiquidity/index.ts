import {
    AddLiquidityBase,
    AddLiquidityBuildCallOutput,
    AddLiquidityInput,
    AddLiquidityQueryOutput,
    AddLiquidityBuildCallInput,
    AddLiquidityConfig,
} from './types';
import { PoolState } from '../types';
import { AddLiquidityV3 } from './addLiquidityV3';
import { InputValidator } from '../inputValidator/inputValidator';
import { Permit2 } from '../permit2Helper';
import {
    missingParameterError,
    exceedingParameterError,
    protocolVersionError,
} from '@/utils';

export class AddLiquidity implements AddLiquidityBase {
    constructor(public config?: AddLiquidityConfig) {}
    private readonly inputValidator: InputValidator = new InputValidator();

    query(
        input: AddLiquidityInput,
        poolState: PoolState,
        block?: bigint,
    ): Promise<AddLiquidityQueryOutput> {
        if (poolState.protocolVersion !== 3) {
            throw protocolVersionError(
                'Add Liquidity',
                poolState.protocolVersion,
            );
        }
        this.inputValidator.validateAddLiquidity(input, poolState);
        const addLiquidity = new AddLiquidityV3();
        return addLiquidity.query(input, poolState, block);
    }

    buildCall(input: AddLiquidityBuildCallInput): AddLiquidityBuildCallOutput {
        if (input.protocolVersion !== 3) {
            throw protocolVersionError(
                'Add Liquidity Build Call',
                input.protocolVersion,
            );
        }
        if (!('userData' in input)) {
            throw missingParameterError(
                'Add Liquidity Build Call',
                'userData',
                3,
            );
        }
        if ('sender' in input || 'recipient' in input) {
            throw exceedingParameterError(
                'Add Liquidity Build Call',
                'sender or recipient',
                input.protocolVersion,
            );
        }
        const addLiquidity = new AddLiquidityV3();
        return addLiquidity.buildCall(input);
    }

    buildCallWithPermit2(
        input: AddLiquidityBuildCallInput,
        permit2: Permit2,
    ): AddLiquidityBuildCallOutput {
        InputValidator.validateBuildCallWithPermit2(input);
        if (!('userData' in input)) {
            throw missingParameterError(
                'Add Liquidity Build Call',
                'userData',
                3,
            );
        }

        const addLiquidity = new AddLiquidityV3();
        return addLiquidity.buildCallWithPermit2(input, permit2);
    }
}
