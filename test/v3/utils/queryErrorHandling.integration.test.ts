// pnpm test test/v3/utils/queryErrorHandling.integration.test.ts

import { ANVIL_NETWORKS, startFork } from 'test/anvil/anvil-global-setup';
import { POOLS, TOKENS } from 'test/lib/utils/addresses';
import { weightedWethUsdc } from 'test/mockData/weightedWethBalPool';
import {
    createTestClient,
    http,
    publicActions,
    TestActions,
    walletActions,
} from 'viem';
import {
    Address,
    CHAINS,
    ChainId,
    PublicWalletClient,
    AddLiquidity,
    Swap,
    SwapInput,
    SwapKind,
    AddLiquidityUnbalancedInput,
    AddLiquidityBaseInput,
    AddLiquidityKind,
} from '@/index';

const chainId = ChainId.SEPOLIA;
const USDC = TOKENS[chainId].USDC_AAVE;
const WETH = TOKENS[chainId].WETH;

describe('query propagates contract revert errors', () => {
    let rpcUrl: string;
    let client: PublicWalletClient & TestActions;
    let testAddress: Address;

    beforeAll(async () => {
        // set up chain and test client
        ({ rpcUrl } = await startFork(ANVIL_NETWORKS.SEPOLIA));

        client = createTestClient({
            mode: 'anvil',
            chain: CHAINS[chainId],
            transport: http(rpcUrl),
        })
            .extend(publicActions)
            .extend(walletActions);

        testAddress = (await client.getAddresses())[0];
    });

    test('Query propagates PoolNotInitialized error', async () => {
        const sampleSwapInput: SwapInput = {
            chainId: chainId,
            paths: [
                {
                    pools: [POOLS[chainId].MOCK_UNINITIALIZED_POOL.id],
                    tokens: [
                        {
                            address: USDC.address,
                            decimals: USDC.decimals,
                        },
                        {
                            address: WETH.address,
                            decimals: WETH.decimals,
                        },
                    ],
                    inputAmountRaw: 1000000n,
                    outputAmountRaw: 1000000n,
                    protocolVersion: 3,
                },
            ],
            swapKind: SwapKind.GivenIn,
        };
        const swap = new Swap(sampleSwapInput);
        await expect(
            swap.query(rpcUrl, undefined, testAddress),
        ).rejects.toThrowError('PoolNotInitialized');
    });
    test('Query propagates MaxInRatio error', async () => {
        const sampleSwapInput: SwapInput = {
            chainId: chainId,
            paths: [
                {
                    pools: [POOLS[chainId].MOCK_WETH_USDC_POOL.id],
                    tokens: [
                        {
                            address: WETH.address,
                            decimals: WETH.decimals,
                        },
                        {
                            address: USDC.address,
                            decimals: USDC.decimals,
                        },
                    ],
                    inputAmountRaw: 10000000000000000000n,
                    outputAmountRaw: 0n,
                    protocolVersion: 3,
                },
            ],
            swapKind: SwapKind.GivenIn,
        };
        const swap = new Swap(sampleSwapInput);
        await expect(swap.query(rpcUrl)).rejects.toThrowError('MaxInRatio');
    });
    test('Query propagates MaxInvariantRatio for an AddLiquidity', async () => {
        const addLiquidity = new AddLiquidity();
        const addLiquidityBaseInput: AddLiquidityBaseInput = {
            chainId: chainId,
            rpcUrl: rpcUrl,
            sender: testAddress,
        };
        const addLiquidityInput: AddLiquidityUnbalancedInput = {
            ...addLiquidityBaseInput,
            kind: AddLiquidityKind.Unbalanced,
            amountsIn: [
                {
                    address: USDC.address,
                    decimals: USDC.decimals,
                    rawAmount: 100000000000000n,
                },
                {
                    address: WETH.address,
                    decimals: WETH.decimals,
                    rawAmount: 100000000000000000000n,
                },
            ],
        };

        await expect(
            addLiquidity.query(addLiquidityInput, weightedWethUsdc),
        ).rejects.toThrowError('InvariantRatioAboveMax');
    });
});
