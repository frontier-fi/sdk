import { createPublicClient, http } from 'viem';
import { ChainId, CHAINS } from '@/utils';
import { Address } from '@/types';
import { frontierBufferRouterAbiExtended } from '@/abi';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';

export const doInitBufferQuery = async (
    rpcUrl: string,
    chainId: ChainId,
    wrappedToken: Address,
    exactAmountUnderlyingIn: bigint,
    exactAmountWrappedIn: bigint,
): Promise<{ issuedShares: bigint }> => {
    const client = createPublicClient({
        transport: http(rpcUrl),
        chain: CHAINS[chainId],
    });

    const { result: issuedShares } = await client.simulateContract({
        address: AddressProvider.BufferRouter(chainId),
        abi: frontierBufferRouterAbiExtended,
        functionName: 'queryInitializeBuffer',
        args: [wrappedToken, exactAmountUnderlyingIn, exactAmountWrappedIn],
    });
    return { issuedShares };
};
