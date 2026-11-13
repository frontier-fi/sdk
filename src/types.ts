export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type BigintIsh = bigint | string | number;

export enum PoolType {
    GyroE = 'GyroE',
    Stable = 'Stable',
    Weighted = 'Weighted',
}

export enum SwapKind {
    GivenIn = 0,
    GivenOut = 1,
}

export type InputToken = {
    address: Address;
    decimals: number;
};

export type InputAmount = InputToken & {
    rawAmount: bigint;
};

export enum TokenType {
    STANDARD = 0,
    TOKEN_WITH_RATE = 1,
}
