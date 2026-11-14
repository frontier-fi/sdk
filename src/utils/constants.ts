import { Address, Chain } from 'viem';
import { base, sepolia } from 'viem/chains';
import { NativeToken } from '../entities/nativeToken';

export const ZERO_ADDRESS: Address =
    '0x0000000000000000000000000000000000000000';
/*
    Using empty account (undefined by default) in some multicall requests causes failures in some nodes
    More info: https://github.com/wevm/viem/issues/2792
*/
export const EMPTY_SENDER = { account: ZERO_ADDRESS };

const NATIVE_ADDRESS: Address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export { DECIMAL_SCALES, MAX_UINT256 } from '@frontier-fi/maths';

export const STABLE_POOL_CONSTRAINTS = {
    MAX_TOKENS: 5,
    MIN_AMP: 1n,
    MAX_AMP: 5000n,
};

export enum ChainId {
    BASE = 8453,
    SEPOLIA = 11155111,
}

// The Frontier API requires the chain to be passed as an uppercase GqlChain string
export const API_CHAIN_NAMES: Record<number, string> = {
    [ChainId.BASE]: 'BASE',
    [ChainId.SEPOLIA]: 'SEPOLIA',
};

export const CHAINS: Record<number, Chain> = {
    [ChainId.BASE]: base,
    [ChainId.SEPOLIA]: sepolia,
};

export const PERMIT2: Record<number, Address> = {
    [ChainId.BASE]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    [ChainId.SEPOLIA]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
};

export const NATIVE_ASSETS: Record<ChainId, NativeToken> = {
    [ChainId.BASE]: new NativeToken(
        ChainId.BASE,
        NATIVE_ADDRESS,
        18,
        '0x4200000000000000000000000000000000000006',
        'ETH',
        'Ether',
    ),
    [ChainId.SEPOLIA]: new NativeToken(
        ChainId.SEPOLIA,
        NATIVE_ADDRESS,
        18,
        '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
        'ETH',
        'Ether',
    ),
};

export const DEFAULT_USERDATA = '0x';

export const API_ENDPOINT = 'https://api.frontier.fi/graphql';
export const TEST_API_ENDPOINT = 'https://api.frontier.fi/graphql';
