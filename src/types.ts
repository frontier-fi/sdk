export type {
    BigintIsh,
    InputAmount,
    InputToken,
} from '@frontier-fi/maths';

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export enum PoolType {
    GyroE = 'GyroE',
    Stable = 'Stable',
    Weighted = 'Weighted',
}

export enum SwapKind {
    GivenIn = 0,
    GivenOut = 1,
}

export enum TokenType {
    STANDARD = 0,
    TOKEN_WITH_RATE = 1,
}
