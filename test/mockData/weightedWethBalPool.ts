import { PoolState } from '@/entities';
import { PoolType } from '@/types';
import { ChainId } from '@/utils';
import { POOLS, TOKENS } from 'test/lib/utils';

const chainId = ChainId.SEPOLIA;
export const MOCK_WETH_USDC_POOL = POOLS[chainId].MOCK_WETH_USDC_POOL;
export const WETH = TOKENS[chainId].WETH;
export const USDC = TOKENS[chainId].USDC_AAVE;

export const weightedWethUsdc: PoolState = {
    id: MOCK_WETH_USDC_POOL.id,
    address: MOCK_WETH_USDC_POOL.address,
    type: PoolType.Weighted,
    protocolVersion: 3,
    tokens: [
        {
            address: USDC.address,
            decimals: USDC.decimals,
            index: 0,
        },
        {
            address: WETH.address,
            decimals: WETH.decimals,
            index: 1,
        },
    ],
};
