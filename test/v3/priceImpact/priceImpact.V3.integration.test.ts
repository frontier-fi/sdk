// pnpm test -- priceImpact/priceImpact.V3.integration.test.ts

import dotenv from 'dotenv';
dotenv.config();

import {
    Address,
    createTestClient,
    http,
    publicActions,
    TestActions,
    walletActions,
} from 'viem';
import {
    AddLiquidityBoostedUnbalancedInput,
    AddLiquidityKind,
    CHAINS,
    ChainId,
    PoolStateWithUnderlyings,
    PriceImpact,
    PublicWalletClient,
} from 'src';

import { ANVIL_NETWORKS, startFork } from 'test/anvil/anvil-global-setup';
import { TOKENS } from 'test/lib/utils/addresses';
import { boostedPool_WBTC_AAVE } from 'test/mockData/boostedPool';
import { createPartialBoostedPool } from 'test/mockData/partialBoostedPool';

const chainId = ChainId.SEPOLIA;
const WBTC = TOKENS[chainId].WBTC;
const AAVE = TOKENS[chainId].AAVE;
const WETH = TOKENS[chainId].WETH;

/**
 * FIXME: tests are here just as a sanity check. We should find a way to
 * properly validate results.
 */
describe('PriceImpact V3', () => {
    let rpcUrl: string;
    let client: PublicWalletClient & TestActions;
    let partialBoostedPool: PoolStateWithUnderlyings;

    beforeAll(async () => {
        ({ rpcUrl } = await startFork(ANVIL_NETWORKS[ChainId[chainId]]));
        client = createTestClient({
            mode: 'anvil',
            chain: CHAINS[chainId],
            transport: http(rpcUrl),
        })
            .extend(publicActions)
            .extend(walletActions);
        const [testAddress] = await client.getAddresses();
        partialBoostedPool = await createPartialBoostedPool(
            client,
            rpcUrl,
            testAddress,
        );
    });

    describe('Full Boosted Pool Boosted Pool AddLiquidity', () => {
        test('Close to proportional', async () => {
            const addLiquidityInput: AddLiquidityBoostedUnbalancedInput = {
                chainId,
                rpcUrl,
                amountsIn: [
                    {
                        rawAmount: 100000n,
                        decimals: WBTC.decimals,
                        address: WBTC.address as Address,
                    },
                    {
                        rawAmount: 122000000000000000n,
                        decimals: AAVE.decimals,
                        address: AAVE.address as Address,
                    },
                ],
                kind: AddLiquidityKind.Unbalanced,
                userData: '0x',
            };
            const priceImpactABA =
                await PriceImpact.addLiquidityUnbalancedBoosted(
                    addLiquidityInput,
                    boostedPool_WBTC_AAVE,
                );
            expect(Math.abs(priceImpactABA.decimal)).toBeLessThan(0.001);
        });

        test('Unbalanced', async () => {
            const addLiquidityInput: AddLiquidityBoostedUnbalancedInput = {
                chainId,
                rpcUrl,
                amountsIn: [
                    {
                        rawAmount: 1000000n,
                        decimals: WBTC.decimals,
                        address: WBTC.address as Address,
                    },
                    {
                        rawAmount: 122000000000000000n,
                        decimals: AAVE.decimals,
                        address: AAVE.address as Address,
                    },
                ],
                kind: AddLiquidityKind.Unbalanced,
                userData: '0x',
            };
            const priceImpactABA =
                await PriceImpact.addLiquidityUnbalancedBoosted(
                    addLiquidityInput,
                    boostedPool_WBTC_AAVE,
                );
            expect(priceImpactABA.decimal).toBeGreaterThan(0.0005);
            expect(priceImpactABA.decimal).toBeLessThan(0.05);
        });

        test('Single token input', async () => {
            const addLiquidityInput: AddLiquidityBoostedUnbalancedInput = {
                chainId,
                rpcUrl,
                amountsIn: [
                    {
                        rawAmount: 100000n,
                        decimals: WBTC.decimals,
                        address: WBTC.address as Address,
                    },
                ],
                kind: AddLiquidityKind.Unbalanced,
                userData: '0x',
            };
            const priceImpactABA =
                await PriceImpact.addLiquidityUnbalancedBoosted(
                    addLiquidityInput,
                    boostedPool_WBTC_AAVE,
                );
            expect(priceImpactABA.decimal).toBeGreaterThan(0);
            expect(priceImpactABA.decimal).toBeLessThan(0.01);
        });
    });

    describe('Partial Boosted Pool Boosted Pool AddLiquidity', () => {
        test('Close to proportional', async () => {
            const addLiquidityInput: AddLiquidityBoostedUnbalancedInput = {
                chainId,
                rpcUrl,
                amountsIn: [
                    {
                        rawAmount: 1000000000000000000n,
                        decimals: AAVE.decimals,
                        address: AAVE.address as Address,
                    },
                    {
                        rawAmount: 10000000000000000n,
                        decimals: WETH.decimals,
                        address: WETH.address as Address,
                    },
                ],
                kind: AddLiquidityKind.Unbalanced,
                userData: '0x',
            };
            const priceImpactABA =
                await PriceImpact.addLiquidityUnbalancedBoosted(
                    addLiquidityInput,
                    partialBoostedPool,
                );
            expect(Math.abs(priceImpactABA.decimal)).toBeLessThan(0.001);
        });

        test('Unbalanced', async () => {
            const addLiquidityInput: AddLiquidityBoostedUnbalancedInput = {
                chainId,
                rpcUrl,
                amountsIn: [
                    {
                        rawAmount: 10000000000000000000n,
                        decimals: AAVE.decimals,
                        address: AAVE.address as Address,
                    },
                    {
                        rawAmount: 10000000000000000n,
                        decimals: WETH.decimals,
                        address: WETH.address as Address,
                    },
                ],
                kind: AddLiquidityKind.Unbalanced,
                userData: '0x',
            };
            const priceImpactABA =
                await PriceImpact.addLiquidityUnbalancedBoosted(
                    addLiquidityInput,
                    partialBoostedPool,
                );
            expect(priceImpactABA.decimal).toBeGreaterThan(0.005);
            expect(priceImpactABA.decimal).toBeLessThan(0.1);
        });
    });
});
