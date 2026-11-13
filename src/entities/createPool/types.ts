import { PoolType, TokenType } from '@/types';
import { Address, Hex } from 'viem';
import {
    EclpParams,
    DerivedEclpParams,
} from './createPoolV3/gyroECLP/createPoolGyroECLP';

export interface CreatePoolBase {
    buildCall(input: CreatePoolInput): CreatePoolBuildCallOutput;
}

export type CreatePoolBaseInput = {
    name?: string;
    symbol: string;
    salt?: Hex;
    chainId: number;
    protocolVersion: 3;
};

export type CreatePoolInput =
    | CreatePoolV3WeightedInput
    | CreatePoolV3StableInput
    | CreatePoolGyroECLPInput;

export type CreatePoolBuildCallOutput = {
    callData: Hex;
    to: Address;
};

export type CreatePoolV3BaseInput<T = TokenConfig> = CreatePoolBaseInput & {
    protocolVersion: 3;
    pauseManager: Address;
    swapFeeManager: Address;
    swapFeePercentage: bigint;
    poolHooksContract: Address;
    enableDonation: boolean;
    disableUnbalancedLiquidity: boolean;
    tokens: T[];
};

export type PoolRoleAccounts = {
    pauseManager: Address;
    swapFeeManager: Address;
    poolCreator: Address;
};

export type TokenConfig = {
    address: Address;
    tokenType: TokenType;
    rateProvider: Address;
    paysYieldFees: boolean;
};

export type TokenConfigWithWeight = TokenConfig & {
    weight: bigint;
};

export type CreatePoolV3WeightedInput =
    CreatePoolV3BaseInput<TokenConfigWithWeight> & {
        poolType: PoolType.Weighted;
        poolCreator: Address;
    };

export type CreatePoolV3StableInput = CreatePoolV3BaseInput & {
    poolType: PoolType.Stable;
    poolCreator: Address;
    amplificationParameter: bigint;
};

export type CreatePoolGyroECLPInput = CreatePoolV3BaseInput & {
    poolType: PoolType.GyroE;
    eclpParams: EclpParams;
    derivedEclpParams?: DerivedEclpParams;
};
