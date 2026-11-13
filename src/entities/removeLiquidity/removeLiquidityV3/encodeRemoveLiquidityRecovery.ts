import { encodeFunctionData } from 'viem';
import { RemoveLiquidityBaseBuildCallInput } from '../types';
import { frontierRouterAbiExtended } from '@/abi';

export const encodeRemoveLiquidityRecovery = (
    input: RemoveLiquidityBaseBuildCallInput,
    minAmountsOut: bigint[],
) => {
    return encodeFunctionData({
        abi: frontierRouterAbiExtended,
        functionName: 'removeLiquidityRecovery',
        args: [input.poolId, input.bptIn.amount, minAmountsOut],
    });
};
