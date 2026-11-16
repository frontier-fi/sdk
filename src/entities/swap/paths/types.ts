import { Address } from 'viem';
import { MinimalToken } from '../../..';

export type TokenApi = Omit<MinimalToken, 'index'>;

export type Path = {
    pools: Address[];
    isBuffer?: boolean[];
    tokens: TokenApi[];
    outputAmountRaw: bigint;
    inputAmountRaw: bigint;
    protocolVersion: 3;
};
