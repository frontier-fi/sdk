import { HumanAmount, MinimalToken, PoolTokenWithBalance } from '../data';
import { Address } from '../types';

// Returned from API and used as input
export type PoolState = {
    id: Address;
    address: Address;
    type: string;
    tokens: MinimalToken[];
    protocolVersion: 3;
};

export type PoolStateWithBalances = {
    id: Address;
    address: Address;
    type: string;
    tokens: PoolTokenWithBalance[];
    totalShares: HumanAmount;
    protocolVersion: 3;
};

export type PoolTokenWithUnderlying = MinimalToken & {
    underlyingToken: MinimalToken | null;
};

export interface PoolTokenWithUnderlyingBalance extends PoolTokenWithBalance {
    underlyingToken: PoolTokenWithBalance | null;
}

export type PoolStateWithUnderlyings = {
    id: Address;
    address: Address;
    type: string;
    tokens: PoolTokenWithUnderlying[];
    protocolVersion: 3;
};

export type PoolStateWithUnderlyingBalances = {
    id: Address;
    address: Address;
    type: string;
    tokens: PoolTokenWithUnderlyingBalance[];
    totalShares: HumanAmount;
    protocolVersion: 3;
};

export type AddLiquidityAmounts = {
    maxAmountsIn: bigint[];
    tokenInIndex: number | undefined;
    minimumBpt: bigint;
};

export type RemoveLiquidityAmounts = {
    minAmountsOut: bigint[];
    tokenOutIndex: number | undefined;
    maxBptAmountIn: bigint;
};

export type InitPoolAmounts = {
    maxAmountsIn: bigint[];
};

export type BufferState = {
    wrappedToken: {
        address: Address;
        decimals: number;
    };
    underlyingToken: {
        address: Address;
        decimals: number;
    };
};
