import { encodeFunctionData } from 'viem';
import { frontierRouterAbiExtended } from '@/abi';
import { Hex } from '@/types';
import { missingParameterError } from '@/utils';
import { RemoveLiquidityV3BuildCallInput } from '../types';

export const encodeRemoveLiquiditySingleTokenExactOut = (
    input: RemoveLiquidityV3BuildCallInput,
    maxBptAmountIn: bigint,
): Hex => {
    // just a sanity check as this is already checked in InputValidator
    if (input.tokenOutIndex === undefined) {
        throw missingParameterError(
            'Remove Liquidity SingleTokenExactOut',
            'tokenOutIndex',
            input.protocolVersion,
        );
    }
    return encodeFunctionData({
        abi: frontierRouterAbiExtended,
        functionName: 'removeLiquiditySingleTokenExactOut',
        args: [
            input.poolId,
            maxBptAmountIn,
            input.amountsOut[input.tokenOutIndex].token.address,
            input.amountsOut[input.tokenOutIndex].amount,
            !!input.wethIsEth,
            input.userData,
        ],
    });
};
