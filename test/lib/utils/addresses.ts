import { Address, Hex, PoolType } from '@/types';
import { ChainId } from '@/utils';

export type TestToken = { address: Address; decimals: number; slot?: number };

export const TOKENS = {
    [ChainId.BASE]: {
        WETH: {
            address: '0x4200000000000000000000000000000000000006',
            decimals: 18,
            slot: 3,
        },
        USDC: {
            address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            decimals: 6,
            slot: 9,
        },
    },
    [ChainId.SEPOLIA]: {
        BAL: {
            address: '0xb19382073c7a0addbb56ac6af1808fa49e377b75',
            decimals: 18,
            slot: 1,
        },
        WETH: {
            address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
            decimals: 18,
            slot: 3,
        },
        DAI: {
            address: '0xb77eb1a70a96fdaaeb31db1b42f2b8b5846b2613',
            decimals: 18,
            slot: 0,
        },
        USDC: {
            address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
            decimals: 6,
            slot: 9,
        },
        USDT: {
            address: '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0',
            decimals: 6,
            slot: 0,
        },
        scUSD: {
            address: '0x990c8eab51d9ecb365bf9b3de09d121af007db68',
            decimals: 18,
            slot: 0,
        },
        scDAI: {
            address: '0xcd20075dc190c411287132e891ec42f009babc73',
            decimals: 18,
            slot: 0,
        },
        USDC_AAVE: {
            address: '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8',
            decimals: 6,
            slot: 0,
        },
        DAI_AAVE: {
            address: '0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357',
            decimals: 18,
            slot: 0,
        },
        USDT_AAVE: {
            address: '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0',
            decimals: 6,
            slot: 0,
        },
        WBTC: {
            address: '0x29f2d40b0605204364af54ec677bd022da425d03',
            decimals: 8,
            slot: 0,
        },
        AAVE: {
            address: '0x88541670e55cc00beefd87eb59edd1b7c511ac9a',
            decimals: 18,
            slot: 0,
        },
        TOK0: {
            address: '0x04d41887928367030259cd4bd9e75cce2bd682b4',
            decimals: 18,
            slot: 0,
        },
        TOK1: {
            address: '0x186bcb14f4ac06ed3a6aba412e1b3c971ae34218',
            decimals: 18,
            slot: 0,
        },
        stataUSDC: {
            address: '0x8a88124522dbbf1e56352ba3de1d9f78c143751e',
            decimals: 6,
            slot: 5,
        },
        stataDAI: {
            address: '0xde46e43f46ff74a23a65ebb0580cbe3dfe684a17',
            decimals: 18,
            slot: 5,
        },
        stataUSDT: {
            address: '0x978206fae13faf5a8d293fb614326b237684b750',
            decimals: 6,
            slot: 5,
        },
        stataEthWBTC: {
            address: '0x131a121bda71ed810bcaf2ac9079214925e59c18',
            decimals: 8,
            slot: 5,
        },
        stataEthAAVE: {
            address: '0x56771cef0cb422e125564cccc98bb05fdc718e77',
            decimals: 18,
            slot: 5,
        },
    },
} satisfies Record<number, Record<string, TestToken>>;

export type TestPool = TestToken & { id: Hex; type: PoolType };

export const POOLS = {
    [ChainId.BASE]: {},
    [ChainId.SEPOLIA]: {
        // USDC_AAVE / WETH (50/50 Weighted)
        MOCK_WETH_USDC_POOL: {
            address: '0xca9f6d682162cca9e0bf3c96de649e372099d89d',
            id: '0xca9f6d682162cca9e0bf3c96de649e372099d89d',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
        // DAI_AAVE / WETH (50/50 Weighted)
        MOCK_WETH_DAI_POOL: {
            address: '0x2543427fa337fb1ac148888b876f357232d93a09',
            id: '0x2543427fa337fb1ac148888b876f357232d93a09',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
        // TOK0 / WETH (50/50 Weighted)
        MOCK_WETH_TOK0_POOL: {
            address: '0x8493a40157a61eeb56365b3b88d31c2d853399f4',
            id: '0x8493a40157a61eeb56365b3b88d31c2d853399f4',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
        // TOK0 / TOK1 (50/50 Weighted)
        MOCK_TOK0_TOK1_POOL: {
            address: '0xa5bfaf67b334ef03b6c032421a2ad6ce2628ecae',
            id: '0xa5bfaf67b334ef03b6c032421a2ad6ce2628ecae',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
        // TOK1 / USDC_AAVE (50/50 Weighted)
        MOCK_TOK1_USDC_POOL: {
            address: '0x1a9f43c8feb989e4d08adfd03084bc9c1edbb7c6',
            id: '0x1a9f43c8feb989e4d08adfd03084bc9c1edbb7c6',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
        // stataEthWBTC / stataEthAAVE (80/20 Weighted Boosted)
        MOCK_BOOSTED_POOL: {
            address: '0x8e06ef1a2e854feaee0a83510acd05f8e443fa4f',
            id: '0x8e06ef1a2e854feaee0a83510acd05f8e443fa4f',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
        // USDC_AAVE / USDT_AAVE / DAI_AAVE (Stable)
        MOCK_STABLE_POOL: {
            address: '0x4898409f170de235844822a9545a54dbe637c049',
            id: '0x4898409f170de235844822a9545a54dbe637c049',
            type: PoolType.Stable,
            decimals: 18,
            slot: 0,
        },
        // Registered uninitialized pool on Frontier Sepolia Vault
        MOCK_UNINITIALIZED_POOL: {
            address: '0xae696a48d9dc28529d76e056d2e696c71c786c25',
            id: '0xae696a48d9dc28529d76e056d2e696c71c786c25',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
    },
} satisfies Record<number, Record<string, TestPool>>;
