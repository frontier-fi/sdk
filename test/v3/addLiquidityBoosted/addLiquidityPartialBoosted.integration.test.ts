// pnpm test -- addLiquidityPartialBoosted.integration.test.ts
import dotenv from 'dotenv';
dotenv.config();

import {
    createTestClient,
    Hex,
    http,
    parseUnits,
    publicActions,
    TestActions,
    walletActions,
} from 'viem';
import {
    Address,
    CHAINS,
    ChainId,
    PERMIT2,
    PoolStateWithUnderlyings,
    PublicWalletClient,
    Slippage,
    Token,
    TokenAmount,
    AddLiquidityBoostedV3,
    AddLiquidityKind,
    AddLiquidityBoostedUnbalancedInput,
    AddLiquidityBoostedProportionalInput,
} from '@/index';
import { ANVIL_NETWORKS, startFork } from 'test/anvil/anvil-global-setup';
import {
    AddLiquidityBoostedTxInput,
    approveSpenderOnPermit2,
    approveSpenderOnToken,
    assertAddLiquidityBoostedProportional,
    assertAddLiquidityBoostedUnbalanced,
    doAddLiquidityBoosted,
    setTokenBalances,
    TOKENS,
} from 'test/lib/utils';
import { createPartialBoostedPool } from 'test/mockData/partialBoostedPool';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';

const chainId = ChainId.SEPOLIA;
const AAVE = TOKENS[chainId].AAVE;
const WETH = TOKENS[chainId].WETH;

// These are the underlying tokens
const aaveToken = new Token(chainId, AAVE.address, AAVE.decimals);
const wethToken = new Token(chainId, WETH.address, WETH.decimals);

describe('V3 add liquidity partial boosted', () => {
    let rpcUrl: string;
    let client: PublicWalletClient & TestActions;
    let testAddress: Address;
    let snapshot: Hex;
    let partialBoostedPool: PoolStateWithUnderlyings;
    const addLiquidityBoosted = new AddLiquidityBoostedV3();
    const amountsIn = [
        TokenAmount.fromHumanAmount(aaveToken, '0.2'),
        TokenAmount.fromHumanAmount(wethToken, '0.02'),
    ];

    beforeAll(async () => {
        // setup chain and test client
        ({ rpcUrl } = await startFork(ANVIL_NETWORKS[ChainId[chainId]]));

        client = createTestClient({
            mode: 'anvil',
            chain: CHAINS[chainId],
            transport: http(rpcUrl, { timeout: 120_000 }),
        })
            .extend(publicActions)
            .extend(walletActions);

        testAddress = (await client.getAddresses())[0];

        partialBoostedPool = await createPartialBoostedPool(
            client,
            rpcUrl,
            testAddress,
        );

        // fork setup
        await setTokenBalances(
            client,
            testAddress,
            amountsIn.map((t) => t.token.address),
            [AAVE.slot, WETH.slot] as number[],
            amountsIn.map((t) => parseUnits('1000', t.token.decimals)),
        );

        for (const token of partialBoostedPool.tokens) {
            // Approve Permit2 to spend account tokens
            await approveSpenderOnToken(
                client,
                testAddress,
                token.underlyingToken?.address ?? token.address,
                PERMIT2[chainId],
            );
            // Approve Router to spend account tokens using Permit2
            await approveSpenderOnPermit2(
                client,
                testAddress,
                token.underlyingToken?.address ?? token.address,
                AddressProvider.CompositeLiquidityRouter(chainId),
            );
        }

        snapshot = await client.snapshot();
    }, 120_000);

    beforeEach(async () => {
        await client.revert({
            id: snapshot,
        });
        snapshot = await client.snapshot();
    });

    describe('unbalanced', async () => {
        let addLiquidityBoostedInput: AddLiquidityBoostedUnbalancedInput;

        beforeAll(async () => {
            addLiquidityBoostedInput = {
                amountsIn: amountsIn.map((a) => ({
                    address: a.token.address,
                    rawAmount: a.amount,
                    decimals: a.token.decimals,
                })),
                chainId,
                rpcUrl,
                kind: AddLiquidityKind.Unbalanced,
            };
        });

        test('with only one token', async () => {
            const wethIsEth = false;

            const txInput: AddLiquidityBoostedTxInput = {
                client,
                addLiquidityBoosted,
                addLiquidityBoostedInput: {
                    ...addLiquidityBoostedInput,
                    amountsIn: [
                        {
                            address: amountsIn[1].token.address,
                            rawAmount: amountsIn[1].amount,
                            decimals: amountsIn[1].token.decimals,
                        },
                    ],
                },
                testAddress,
                poolStateWithUnderlyings: partialBoostedPool,
                slippage: Slippage.fromPercentage('1'),
                wethIsEth,
            };

            const {
                addLiquidityBoostedQueryOutput,
                addLiquidityBuildCallOutput,
                tokenAmountsForBalanceCheck,
                txOutput,
            } = await doAddLiquidityBoosted(txInput);

            assertAddLiquidityBoostedUnbalanced(
                {
                    addLiquidityBoostedQueryOutput,
                    addLiquidityBuildCallOutput,
                    tokenAmountsForBalanceCheck,
                    txOutput,
                },
                wethIsEth,
            );
        });

        test('with two tokens', async () => {
            const wethIsEth = false;

            const txInput: AddLiquidityBoostedTxInput = {
                client,
                addLiquidityBoosted,
                addLiquidityBoostedInput,
                testAddress,
                poolStateWithUnderlyings: partialBoostedPool,
                slippage: Slippage.fromPercentage('1'),
                wethIsEth,
            };

            const {
                addLiquidityBoostedQueryOutput,
                addLiquidityBuildCallOutput,
                tokenAmountsForBalanceCheck,
                txOutput,
            } = await doAddLiquidityBoosted(txInput);

            assertAddLiquidityBoostedUnbalanced(
                {
                    addLiquidityBoostedQueryOutput,
                    addLiquidityBuildCallOutput,
                    tokenAmountsForBalanceCheck,
                    txOutput,
                },
                wethIsEth,
            );
        });

        test('with native', async () => {
            const wethIsEth = true;

            const txInput: AddLiquidityBoostedTxInput = {
                client,
                addLiquidityBoosted,
                addLiquidityBoostedInput,
                testAddress,
                poolStateWithUnderlyings: partialBoostedPool,
                slippage: Slippage.fromPercentage('1'),
                wethIsEth,
            };

            const {
                addLiquidityBoostedQueryOutput,
                addLiquidityBuildCallOutput,
                tokenAmountsForBalanceCheck,
                txOutput,
            } = await doAddLiquidityBoosted(txInput);

            assertAddLiquidityBoostedUnbalanced(
                {
                    addLiquidityBoostedQueryOutput,
                    addLiquidityBuildCallOutput,
                    tokenAmountsForBalanceCheck,
                    txOutput,
                },
                wethIsEth,
            );
        });
    });

    describe('proportional', async () => {
        let addLiquidityBoostedInput: AddLiquidityBoostedProportionalInput;
        let referenceTokenAmount: TokenAmount;
        beforeAll(async () => {
            referenceTokenAmount = amountsIn[0];
            addLiquidityBoostedInput = {
                referenceAmount: {
                    address: referenceTokenAmount.token.address,
                    rawAmount: referenceTokenAmount.amount,
                    decimals: referenceTokenAmount.token.decimals,
                },
                chainId,
                rpcUrl,
                kind: AddLiquidityKind.Proportional,
                tokensIn: [AAVE.address, WETH.address],
            };
        });

        test('with tokens', async () => {
            const wethIsEth = false;
            const txInput: AddLiquidityBoostedTxInput = {
                client,
                addLiquidityBoosted,
                addLiquidityBoostedInput,
                testAddress,
                poolStateWithUnderlyings: partialBoostedPool,
                slippage: Slippage.fromPercentage('1'),
                wethIsEth,
            };

            const {
                addLiquidityBoostedQueryOutput,
                addLiquidityBuildCallOutput,
                tokenAmountsForBalanceCheck,
                txOutput,
            } = await doAddLiquidityBoosted(txInput);

            assertAddLiquidityBoostedProportional(
                {
                    addLiquidityBoostedQueryOutput,
                    addLiquidityBuildCallOutput,
                    tokenAmountsForBalanceCheck,
                    txOutput,
                },
                wethIsEth,
            );
        });

        test('with native', async () => {
            const wethIsEth = true;

            const txInput: AddLiquidityBoostedTxInput = {
                client,
                addLiquidityBoosted,
                addLiquidityBoostedInput,
                testAddress,
                poolStateWithUnderlyings: partialBoostedPool,
                slippage: Slippage.fromPercentage('1'),
                wethIsEth,
            };

            const {
                addLiquidityBoostedQueryOutput,
                addLiquidityBuildCallOutput,
                tokenAmountsForBalanceCheck,
                txOutput,
            } = await doAddLiquidityBoosted(txInput);

            assertAddLiquidityBoostedProportional(
                {
                    addLiquidityBoostedQueryOutput,
                    addLiquidityBuildCallOutput,
                    tokenAmountsForBalanceCheck,
                    txOutput,
                },
                wethIsEth,
            );
        });
    });
});
