import { createPublicClient, Hex, http } from 'viem';

import { ChainId, CHAINS } from '@/utils';

import { Address } from '@/types';
import { frontierCompositeLiquidityRouterBoostedAbiExtended } from '@/abi';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';

export const doAddLiquidityUnbalancedQuery = async (
    rpcUrl: string,
    chainId: ChainId,
    sender: Address,
    userData: Hex,
    poolAddress: Address,
    wrapUnderlying: boolean[],
    exactUnderlyingAmountsIn: bigint[],
    block?: bigint,
): Promise<bigint> => {
    const client = createPublicClient({
        transport: http(rpcUrl),
        chain: CHAINS[chainId],
    });

    const { result: bptAmountOut } = await client.simulateContract({
        address: AddressProvider.CompositeLiquidityRouter(chainId),
        abi: frontierCompositeLiquidityRouterBoostedAbiExtended,
        functionName: 'queryAddLiquidityUnbalancedToERC4626Pool',
        args: [
            poolAddress,
            wrapUnderlying,
            exactUnderlyingAmountsIn,
            sender,
            userData,
        ],
        blockNumber: block,
    });
    return bptAmountOut;
};
