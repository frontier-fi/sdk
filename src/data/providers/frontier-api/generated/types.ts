/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
    | T
    | {
          [P in keyof T]?: P extends ' $fragmentName' | '__typename'
              ? T[P]
              : never;
      };
export type GqlChain = 'SEPOLIA';

/** Supported pool types */
export type GqlPoolType = 'ECLP' | 'STABLE' | 'WEIGHTED';

export type GqlSorSwapType = 'EXACT_IN' | 'EXACT_OUT';

export type poolGetPoolWithUnderlyingsQueryVariables = Exact<{
    id: string;
    chain: GqlChain;
}>;

export type poolGetPoolWithUnderlyingsQuery = {
    poolGetPool:
        | {
              id: string;
              address: string;
              type: GqlPoolType;
              protocolVersion: number;
              poolTokens: Array<{
                  index: number;
                  address: string;
                  decimals: number;
                  underlyingToken: { address: string; decimals: number } | null;
              }>;
          }
        | {
              id: string;
              address: string;
              type: GqlPoolType;
              protocolVersion: number;
              poolTokens: Array<{
                  index: number;
                  address: string;
                  decimals: number;
                  underlyingToken: { address: string; decimals: number } | null;
              }>;
          }
        | {
              id: string;
              address: string;
              type: GqlPoolType;
              protocolVersion: number;
              poolTokens: Array<{
                  index: number;
                  address: string;
                  decimals: number;
                  underlyingToken: { address: string; decimals: number } | null;
              }>;
          };
};

export type tokenGetTokensQueryVariables = Exact<{
    wrappedTokenAddress: string;
    chain: GqlChain;
}>;

export type tokenGetTokensQuery = {
    tokenGetTokens: Array<{
        address: string;
        decimals: number;
        isErc4626: boolean;
        underlyingTokenAddress: string | null;
    }>;
};

export type poolGetPoolQueryVariables = Exact<{
    id: string;
    chain: GqlChain;
}>;

export type poolGetPoolQuery = {
    poolGetPool:
        | {
              id: string;
              address: string;
              type: GqlPoolType;
              protocolVersion: number;
              poolTokens: Array<{
                  index: number;
                  address: string;
                  decimals: number;
              }>;
          }
        | {
              id: string;
              address: string;
              type: GqlPoolType;
              protocolVersion: number;
              poolTokens: Array<{
                  index: number;
                  address: string;
                  decimals: number;
              }>;
          }
        | {
              id: string;
              address: string;
              type: GqlPoolType;
              protocolVersion: number;
              poolTokens: Array<{
                  index: number;
                  address: string;
                  decimals: number;
              }>;
          };
};

export type poolGetPoolWithBalancesQueryVariables = Exact<{
    id: string;
    chain: GqlChain;
}>;

export type poolGetPoolWithBalancesQuery = {
    poolGetPool:
        | {
              id: string;
              address: string;
              type: GqlPoolType;
              protocolVersion: number;
              poolTokens: Array<{
                  index: number;
                  address: string;
                  decimals: number;
                  balance: string;
              }>;
              dynamicData: { totalShares: string };
          }
        | {
              id: string;
              address: string;
              type: GqlPoolType;
              protocolVersion: number;
              poolTokens: Array<{
                  index: number;
                  address: string;
                  decimals: number;
                  balance: string;
              }>;
              dynamicData: { totalShares: string };
          }
        | {
              id: string;
              address: string;
              type: GqlPoolType;
              protocolVersion: number;
              poolTokens: Array<{
                  index: number;
                  address: string;
                  decimals: number;
                  balance: string;
              }>;
              dynamicData: { totalShares: string };
          };
};

export type sorGetSwapPathsQueryVariables = Exact<{
    chain: GqlChain;
    swapType: GqlSorSwapType;
    swapAmount: string;
    tokenIn: string;
    tokenOut: string;
    considerPoolsWithHooks?: boolean | null | undefined;
    poolIds?: Array<string> | string | null | undefined;
}>;

export type sorGetSwapPathsQuery = {
    sorGetSwapPaths: {
        tokenInAmount: string;
        tokenOutAmount: string;
        returnAmount: string;
        swapAmount: string;
        priceImpact: { error: string | null; priceImpact: string | null };
        paths: Array<{
            inputAmountRaw: string;
            outputAmountRaw: string;
            pools: Array<string>;
            isBuffer: Array<boolean>;
            protocolVersion: number;
            tokens: Array<{ address: string; decimals: number }>;
        }>;
    };
};

export type sorGetSwapPathsWithVersionQueryVariables = Exact<{
    chain: GqlChain;
    swapType: GqlSorSwapType;
    swapAmount: string;
    tokenIn: string;
    tokenOut: string;
    useProtocolVersion: number;
    poolIds?: Array<string> | string | null | undefined;
    considerPoolsWithHooks?: boolean | null | undefined;
}>;

export type sorGetSwapPathsWithVersionQuery = {
    sorGetSwapPaths: {
        tokenInAmount: string;
        tokenOutAmount: string;
        returnAmount: string;
        swapAmount: string;
        priceImpact: { error: string | null; priceImpact: string | null };
        paths: Array<{
            inputAmountRaw: string;
            outputAmountRaw: string;
            pools: Array<string>;
            isBuffer: Array<boolean>;
            protocolVersion: number;
            tokens: Array<{ address: string; decimals: number }>;
        }>;
    };
};
