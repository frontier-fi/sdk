import { PoolStateWithUnderlyings } from '@/entities';
import { PoolType } from '@/types';
import { ChainId } from '@/utils';
import { POOLS, TOKENS } from 'test/lib/utils';

const chainId = ChainId.SEPOLIA;
const BOOSTED_POOL = POOLS[chainId].MOCK_BOOSTED_POOL;
const stataEthWBTC = TOKENS[chainId].stataEthWBTC;
const WBTC = TOKENS[chainId].WBTC;
const stataEthAAVE = TOKENS[chainId].stataEthAAVE;
const AAVE = TOKENS[chainId].AAVE;

export const boostedPool_WBTC_AAVE: PoolStateWithUnderlyings = {
    id: BOOSTED_POOL.id,
    address: BOOSTED_POOL.address,
    type: PoolType.Weighted,
    protocolVersion: 3,
    tokens: [
        {
            index: 0,
            address: stataEthWBTC.address,
            decimals: stataEthWBTC.decimals,
            underlyingToken: {
                address: WBTC.address,
                decimals: WBTC.decimals,
                index: 0,
            },
        },
        {
            index: 1,
            address: stataEthAAVE.address,
            decimals: stataEthAAVE.decimals,
            underlyingToken: {
                address: AAVE.address,
                decimals: AAVE.decimals,
                index: 1,
            },
        },
    ],
};
