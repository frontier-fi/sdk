import { FrontierApiClient } from '../../client';
import { PoolState, PoolStateWithBalances } from '../../../../../entities';
import { API_CHAIN_NAMES, protocolVersionError } from '../../../../../utils';
import { gql } from 'graphql-tag';
import { DocumentNode, print } from 'graphql';
import { Address } from 'viem';
import {
    poolGetPoolQuery,
    poolGetPoolWithBalancesQuery,
} from '../../generated/types';

export class Pools {
    readonly poolStateQuery: DocumentNode = gql`
    query poolGetPool($id: String!, $chain: GqlChain!) {
      poolGetPool(id: $id, chain: $chain) {
        id
        address
        type
        protocolVersion
        poolTokens {
          index
          address
          decimals
        }
      }
    }`;

    readonly poolStateWithRawTokensQuery: DocumentNode = gql`
    query poolGetPoolWithBalances($id: String!, $chain: GqlChain!) {
      poolGetPool(id: $id, chain: $chain) {
        id
        address
        type
        protocolVersion
        poolTokens {
          index
          address
          decimals
          balance
        }
        dynamicData {
          totalShares
        }
      }
    }`;

    constructor(private readonly frontierApiClient: FrontierApiClient) {}

    async fetchPoolState(id: string): Promise<PoolState> {
        const { data } = await this.frontierApiClient.fetch({
            query: print(this.poolStateQuery),
            variables: {
                id: id.toLowerCase(),
                // the API requires chain names to be sent as uppercase strings
                chain: API_CHAIN_NAMES[this.frontierApiClient.chainId],
            },
        });

        // Now data is fully typed as poolGetPoolQuery
        const apiResponse: poolGetPoolQuery = data;
        const poolData = apiResponse.poolGetPool;
        if (poolData.protocolVersion !== 3) {
            throw protocolVersionError(
                'fetchPoolState',
                poolData.protocolVersion,
            );
        }

        return {
            ...poolData,
            id: poolData.id as `0x${string}`,
            address: poolData.address as Address,
            protocolVersion: 3,
            tokens: poolData.poolTokens.map((token) => ({
                address: token.address as Address,
                decimals: token.decimals,
                index: token.index,
            })),
            type: poolData.type,
        };
    }

    async fetchPoolStateWithBalances(
        id: string,
    ): Promise<PoolStateWithBalances> {
        const { data } = await this.frontierApiClient.fetch({
            query: print(this.poolStateWithRawTokensQuery),
            variables: {
                id: id.toLowerCase(),
                // the API requires chain names to be sent as uppercase strings
                chain: API_CHAIN_NAMES[this.frontierApiClient.chainId],
            },
        });

        // Now data is fully typed as poolGetPoolWithBalancesQuery
        const apiResponse: poolGetPoolWithBalancesQuery = data;
        const poolData = apiResponse.poolGetPool;
        if (poolData.protocolVersion !== 3) {
            throw protocolVersionError(
                'fetchPoolStateWithBalances',
                poolData.protocolVersion,
            );
        }

        return {
            ...poolData,
            id: poolData.id as `0x${string}`,
            address: poolData.address as Address,
            protocolVersion: 3,
            tokens: poolData.poolTokens.map((token) => ({
                address: token.address as Address,
                decimals: token.decimals,
                index: token.index,
                balance: token.balance as `${number}`,
            })),
            type: poolData.type,
            totalShares: poolData.dynamicData.totalShares as `${number}`,
        };
    }
}
