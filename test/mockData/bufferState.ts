import { BufferState } from '@/entities';
import { ChainId } from '@/utils';
import { TOKENS } from 'test/lib/utils';

const chainId = ChainId.SEPOLIA;

export const bufferState_WBTC_stataEthWBTC: BufferState = {
    wrappedToken: {
        address: TOKENS[chainId].stataEthWBTC.address,
        decimals: TOKENS[chainId].stataEthWBTC.decimals,
    },
    underlyingToken: {
        address: TOKENS[chainId].WBTC.address,
        decimals: TOKENS[chainId].WBTC.decimals,
    },
};

export const bufferState_AAVE_stataEthAAVE: BufferState = {
    wrappedToken: {
        address: TOKENS[chainId].stataEthAAVE.address,
        decimals: TOKENS[chainId].stataEthAAVE.decimals,
    },
    underlyingToken: {
        address: TOKENS[chainId].AAVE.address,
        decimals: TOKENS[chainId].AAVE.decimals,
    },
};
