// pnpm test test/validateNewChainSetup.test.ts

import {
    API_CHAIN_NAMES,
    API_ENDPOINT,
    CHAINS,
    ChainId,
    NATIVE_ASSETS,
    PERMIT2,
} from '@/utils';
import { SorSwapPaths } from '@/data/providers/frontier-api/modules/sorSwapPaths';
import { FrontierApiClient } from '@/data/providers/frontier-api/client';

const SDK_CHAINS = Object.values(ChainId).filter(
    (v): v is ChainId => typeof v === 'number',
);

describe('Frontier SDK supports all Frontier API chains and static chain configs', () => {
    let apiGqlChains: string[] = [];

    beforeAll(async () => {
        apiGqlChains = await fetchSupportedChains(API_ENDPOINT);
    });

    test('All Frontier API GqlChain entries map to a configured SDK ChainId', () => {
        expect(apiGqlChains.length).toBeGreaterThan(0);

        const missingInSdk: string[] = [];
        for (const apiChainName of apiGqlChains) {
            const chainIdEntry = Object.entries(API_CHAIN_NAMES).find(
                ([, apiName]) => apiName === apiChainName,
            );
            if (!chainIdEntry) {
                missingInSdk.push(apiChainName);
            }
        }

        expect(missingInSdk).toHaveLength(0);
    });

    test('FrontierApi SorSwapPaths maps all SDK chains', () => {
        const sorSwapPaths = new SorSwapPaths(
            null as unknown as FrontierApiClient,
        );

        for (const chainId of SDK_CHAINS) {
            expect(sorSwapPaths.mapGqlChain(chainId)).toBeDefined();
        }
    });

    test('All SDK chains have CHAINS, NATIVE_ASSETS, and PERMIT2 entries', () => {
        for (const chainId of SDK_CHAINS) {
            expect(CHAINS[chainId]).toBeDefined();
            expect(NATIVE_ASSETS[chainId]).toBeDefined();
            expect(PERMIT2[chainId]).toBeDefined();
        }
    });
});

const introspectionQuery = `
  query IntrospectGqlChain {
    __type(name: "GqlChain") {
      name
      enumValues {
        name
        description
      }
    }
  }
`;

type GqlChainEnumValue = {
    name: string;
    description?: string;
};

async function fetchSupportedChains(endpoint: string) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: introspectionQuery,
            }),
        });

        const data = await response.json();
        const enumValues: GqlChainEnumValue[] = data.data.__type.enumValues;

        return enumValues.map((ev: GqlChainEnumValue) => ev.name);
    } catch (error) {
        console.error('Error fetching enum values:', error);
        return [];
    }
}
