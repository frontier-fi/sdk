import { CHAINS } from '@/utils';
import { http, Address, createPublicClient, erc4626Abi } from 'viem';
import { AddressProvider } from '../inputValidator/utils/addressProvider';

type PreviewFunction =
    | 'previewDeposit'
    | 'previewMint'
    | 'previewRedeem'
    | 'previewWithdraw';

/** Read an ERC4626 conversion for the internal price-impact fallback. */
export async function previewErc4626(
    rpcUrl: string,
    chainId: number,
    wrapperAddress: Address,
    functionName: PreviewFunction,
    amount: bigint,
): Promise<bigint> {
    const client = createPublicClient({
        chain: CHAINS[chainId],
        transport: http(rpcUrl),
    });
    return client.readContract({
        address: wrapperAddress,
        abi: erc4626Abi,
        // The Vault is the caller of ERC4626 previews in buffer queries.
        account: AddressProvider.Vault(chainId),
        functionName,
        args: [amount],
    });
}
