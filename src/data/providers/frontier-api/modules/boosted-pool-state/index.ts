import { FrontierApiClient } from '../../client';
import { PoolStateWithUnderlyings } from '../../../../../entities';
import { API_CHAIN_NAMES, protocolVersionError } from '../../../../../utils';
import { gql } from 'graphql-tag';
import { DocumentNode, print } from 'graphql';
import { Address } from 'viem';
import { poolGetPoolWithUnderlyingsQuery } from '../../generated/types';

export class BoostedPools {
    readonly boostedPoolStateQuery: DocumentNode = gql`
    query poolGetPoolWithUnderlyings($id: String!, $chain: GqlChain!) {
      poolGetPool(id: $id, chain: $chain) {
        id
        address
        type
        protocolVersion
        poolTokens {
          index
          address
          decimals
          underlyingToken {
            address
            decimals
          }
        }
      }
    }`;

    constructor(private readonly frontierApiClient: FrontierApiClient) {}

    async fetchPoolStateWithUnderlyings(
        id: string,
    ): Promise<PoolStateWithUnderlyings> {
        const { data } = await this.frontierApiClient.fetch({
            query: print(this.boostedPoolStateQuery),
            variables: {
                id: id.toLowerCase(),
                // the API requires chain names to be sent as uppercase strings
                chain: API_CHAIN_NAMES[this.frontierApiClient.chainId],
            },
        });

        // Now data is fully typed as poolGetPoolWithUnderlyingsQuery
        const apiResponse: poolGetPoolWithUnderlyingsQuery = data;
        const poolData = apiResponse.poolGetPool;
        if (poolData.protocolVersion !== 3) {
            throw protocolVersionError(
                'fetchPoolStateWithUnderlyings',
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
                underlyingToken: token.underlyingToken
                    ? {
                          address: token.underlyingToken.address as Address,
                          decimals: token.underlyingToken.decimals,
                          index: token.index,
                      }
                    : null,
            })),
            type: poolData.type,
        };
    }
}
