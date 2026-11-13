import { Address, Hex, PoolType } from '@/types';
import { ChainId } from '@/utils';

export type TestToken = { address: Address; decimals: number; slot?: number };

export const TOKENS: Record<number, Record<string, TestToken>> = {
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
            address: '0xb19382073c7A0aDdbb56Ac6AF1808Fa49e377B75',
            decimals: 18,
            slot: 1,
        },
        WETH: {
            address: '0x7b79995e5f793a07bc00c21412e50ecae098e7f9',
            decimals: 18,
            slot: 3,
        },
        DAI: {
            address: '0xb77eb1a70a96fdaaeb31db1b42f2b8b5846b2613',
            decimals: 18,
            slot: 0,
        },
        USDC: {
            address: '0x80d6d3946ed8a1da4e226aa21ccddc32bd127d1a',
            decimals: 6,
            slot: 0,
        },
        USDT: {
            address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
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
            address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
            decimals: 6,
            slot: 0,
        },
        DAI_AAVE: {
            address: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
            decimals: 18,
            slot: 0,
        },
        USDT_AAVE: {
            address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
            decimals: 6,
            slot: 0,
        },
        stataUSDC: {
            address: '0x8a88124522dbbf1e56352ba3de1d9f78c143751e',
            decimals: 6,
            slot: 0,
        },
        stataDAI: {
            address: '0xde46e43f46ff74a23a65ebb0580cbe3dfe684a17',
            decimals: 18,
            slot: 0,
        },
        stataUSDT: {
            address: '0x978206fae13faf5a8d293fb614326b237684b750',
            decimals: 6,
            slot: 0,
        },
    },
};

export type TestPool = TestToken & { id: Hex; type: PoolType };

export const POOLS: Record<number, Record<string, TestPool>> = {
    [ChainId.BASE]: {},
    [ChainId.SEPOLIA]: {
        MOCK_WETH_BAL_POOL: {
            address: '0xb790fa0ba5d563b814b0ca1716c414f6b99937b2',
            id: '0xb790fa0ba5d563b814b0ca1716c414f6b99937b2',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
        MOCK_BAL_DAI_POOL: {
            address: '0x3e099b16beeae7cfcf8a0921941394f1a9b00e0e',
            id: '0x3e099b16beeae7cfcf8a0921941394f1a9b00e0e',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
        MOCK_USDC_DAI_POOL: {
            address: '0x86fde41ff01b35846eb2f27868fb2938addd44c4',
            id: '0x86fde41ff01b35846eb2f27868fb2938addd44c4',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
        // stataUSDC, stataUSDT
        MOCK_BOOSTED_POOL: {
            address: '0x59fa488dda749cdd41772bb068bb23ee955a6d7a',
            id: '0x59fa488dda749cdd41772bb068bb23ee955a6d7a',
            type: PoolType.Stable,
            decimals: 18,
            slot: 0,
        },
        // weth, stataUSDT
        MOCK_BOOSTED_POOL_WETH: {
            address: '0xf5a25990da505a9d4c3e0d876f3951e9edf9abc3',
            id: '0xf5a25990da505a9d4c3e0d876f3951e9edf9abc3',
            type: PoolType.Weighted,
            decimals: 18,
            slot: 0,
        },
        // usdc, dai
        MOCK_STABLE_POOL: {
            address: '0x5b17fb19b8c44f126e87882e7baa32153edcaf1d',
            id: '0x5b17fb19b8c44f126e87882e7baa32153edcaf1d',
            type: PoolType.Stable,
            decimals: 18,
            slot: 0,
        },
    },
};
