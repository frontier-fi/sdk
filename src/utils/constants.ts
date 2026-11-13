import { Address, Chain } from 'viem';
import { sepolia } from 'viem/chains';
import { NativeToken } from '../entities/nativeToken';

export const ZERO_ADDRESS: Address =
    '0x0000000000000000000000000000000000000000';
/*
    Using empty account (undefined by default) in some multicall requests causes failures in some nodes
    More info: https://github.com/wevm/viem/issues/2792
*/
export const EMPTY_SENDER = { account: ZERO_ADDRESS };

const NATIVE_ADDRESS: Address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export const MAX_UINT112 = 5192296858534827628530496329220095n;
export const MAX_UINT256 =
    115792089237316195423570985008687907853269984665640564039457584007913129639935n;
export const PREMINTED_STABLE_BPT = 2596148429267413814265248164610048n; // 2**111

export const STABLE_POOL_CONSTRAINTS = {
    MAX_TOKENS: 5,
    MIN_AMP: 1n,
    MAX_AMP: 5000n,
};

export const DECIMAL_SCALES = {
    0: 1n,
    1: 10n,
    2: 100n,
    3: 1000n,
    4: 10000n,
    5: 100000n,
    6: 1000000n,
    7: 10000000n,
    8: 100000000n,
    9: 1000000000n,
    10: 10000000000n,
    11: 100000000000n,
    12: 1000000000000n,
    13: 10000000000000n,
    14: 100000000000000n,
    15: 1000000000000000n,
    16: 10000000000000000n,
    17: 100000000000000000n,
    18: 1000000000000000000n,
};

export const SECONDS_PER_YEAR = 31536000n;

export enum ChainId {
    SEPOLIA = 11155111,
}

// The Frontier API requires the chain to be passed as an uppercase GqlChain string
export const API_CHAIN_NAMES: Record<number, string> = {
    [ChainId.SEPOLIA]: 'SEPOLIA',
};

export const CHAINS: Record<number, Chain> = {
    [ChainId.SEPOLIA]: sepolia,
};

export const PERMIT2: Record<number, Address> = {
    [ChainId.SEPOLIA]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
};

export const NATIVE_ASSETS: Record<number, NativeToken> = {
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
