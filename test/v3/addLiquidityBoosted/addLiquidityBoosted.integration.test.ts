// pnpm test -- v3/addLiquidityBoosted/addLiquidityBoosted.integration.test.ts

import { config } from 'dotenv';
config();

import {
    Address,
    createTestClient,
    Hex,
    http,
    parseUnits,
    publicActions,
    TestActions,
    walletActions,
} from 'viem';

import {
    AddLiquidityKind,
    Slippage,
    CHAINS,
    ChainId,
    AddLiquidityBoostedV3,
    Permit2Helper,
    PERMIT2,
    Token,
    PublicWalletClient,
    AddLiquidityBoostedBuildCallInput,
    AddLiquidityBoostedInput,
    AddLiquidityBoostedUnbalancedInput,
    AddLiquidityBoostedProportionalInput,
    TokenAmount,
} from '../../../src';
import {
    AddLiquidityBoostedTxInput,
    approveSpenderOnPermit2,
    approveSpenderOnTokens,
    areBigIntsWithinPercent,
    assertAddLiquidityBoostedProportional,
    assertAddLiquidityBoostedUnbalanced,
    assertTokenMatch,
    doAddLiquidityBoosted,
    sendTransactionGetBalances,
    setTokenBalances,
    TOKENS,
} from 'test/lib/utils';
import { ANVIL_NETWORKS, startFork } from '../../anvil/anvil-global-setup';
import { boostedPool_WBTC_AAVE } from 'test/mockData/boostedPool';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';

const chainId = ChainId.SEPOLIA;
const WBTC = TOKENS[chainId].WBTC;
const AAVE = TOKENS[chainId].AAVE;
const stataAAVE = TOKENS[chainId].stataEthAAVE;

// These are the underlying and wrapped tokens
const wbtcToken = new Token(chainId, WBTC.address, WBTC.decimals);
const aaveToken = new Token(chainId, AAVE.address, AAVE.decimals);
const stataAaveToken = new Token(
    chainId,
    stataAAVE.address,
    stataAAVE.decimals,
);

describe('Boosted AddLiquidity', () => {
    let client: PublicWalletClient & TestActions;
    let rpcUrl: string;
    let snapshot: Hex;
    let testAddress: Address;
    const addLiquidityBoosted = new AddLiquidityBoostedV3();

    // for unbalanced inputs
    const amountsInForSingleWrap = [
        TokenAmount.fromHumanAmount(wbtcToken, '0.001'),
        TokenAmount.fromHumanAmount(stataAaveToken, '0.2'),
    ].map((a) => ({
        address: a.token.address,
        rawAmount: a.amount,
        decimals: a.token.decimals,
    }));
    const amountsInForDoubleWrap = [
        TokenAmount.fromHumanAmount(wbtcToken, '0.001'),
        TokenAmount.fromHumanAmount(aaveToken, '0.2'),
    ].map((a) => ({
        address: a.token.address,
        rawAmount: a.amount,
        decimals: a.token.decimals,
    }));

    // for proportional inputs
    const tokensInForSingleWrap = [WBTC.address, stataAAVE.address];
    const tokensInForDoubleWrap = [WBTC.address, AAVE.address];

    beforeAll(async () => {
        ({ rpcUrl } = await startFork(ANVIL_NETWORKS[ChainId[chainId]]));

        client = createTestClient({
            mode: 'anvil',
            chain: CHAINS[chainId],
            transport: http(rpcUrl),
        })
            .extend(publicActions)
            .extend(walletActions);

        testAddress = (await client.getAddresses())[0];

        await setTokenBalances(
            client,
            testAddress,
            [WBTC.address, AAVE.address, stataAAVE.address],
            [WBTC.slot, AAVE.slot, stataAAVE.slot] as number[],
            [
                parseUnits('10', WBTC.decimals),
                parseUnits('1000', AAVE.decimals),
                parseUnits('100', stataAAVE.decimals),
            ],
        );

        // approve Permit2 to spend user tokens, does not include the sub approvals
        await approveSpenderOnTokens(
            client,
            testAddress,
            [WBTC.address, AAVE.address, stataAAVE.address],
            PERMIT2[chainId],
        );

        snapshot = await client.snapshot();
    }, 120_000);

    beforeEach(async () => {
        await client.revert({
            id: snapshot,
        });
        snapshot = await client.snapshot();
    });

    describe('query', () => {
        test('unbalanced returns correct tokens', async () => {
            const addLiquidityBoostedInput: AddLiquidityBoostedUnbalancedInput =
                {
                    chainId,
                    rpcUrl,
                    amountsIn: amountsInForSingleWrap,
                    kind: AddLiquidityKind.Unbalanced,
                };

            const addLiquidityQueryOutput = await addLiquidityBoosted.query(
                addLiquidityBoostedInput,
                boostedPool_WBTC_AAVE,
            );

            const amountsIn = addLiquidityQueryOutput.amountsIn;

            expect(amountsIn[0].token.address).to.eq(wbtcToken.address);
            expect(amountsIn[1].token.address).to.eq(stataAaveToken.address);
        });

        test('proportional returns correct tokens', async () => {
            const referenceAmount = {
                rawAmount: 100000n,
                decimals: WBTC.decimals,
                address: WBTC.address,
            };

            const addLiquidityBoostedInput: AddLiquidityBoostedProportionalInput =
                {
                    chainId,
                    rpcUrl,
                    referenceAmount,
                    tokensIn: tokensInForSingleWrap,
                    kind: AddLiquidityKind.Proportional,
                };

            const addLiquidityQueryOutput = await addLiquidityBoosted.query(
                addLiquidityBoostedInput,
                boostedPool_WBTC_AAVE,
            );

            const amountsIn = addLiquidityQueryOutput.amountsIn;

            expect(amountsIn[0].token.address).to.eq(wbtcToken.address);
            expect(amountsIn[1].token.address).to.eq(stataAaveToken.address);
        });
    });

    describe('permit 2 direct approval', () => {
        beforeEach(async () => {
            // Here we approve the Vault to spend tokens on the users behalf via Permit2
            for (const token of boostedPool_WBTC_AAVE.tokens) {
                await approveSpenderOnPermit2(
                    client,
                    testAddress,
                    token.address,
                    AddressProvider.CompositeLiquidityRouter(chainId),
                );

                if (token.underlyingToken) {
                    await approveSpenderOnPermit2(
                        client,
                        testAddress,
                        token.underlyingToken.address,
                        AddressProvider.CompositeLiquidityRouter(chainId),
                    );
                }
            }
        });
        describe('unbalanced', () => {
            test('with only one token', async () => {
                const wethIsEth = false;
                const addLiquidityBoostedInput: AddLiquidityBoostedUnbalancedInput =
                    {
                        chainId,
                        rpcUrl,
                        amountsIn: [amountsInForDoubleWrap[0]],
                        kind: AddLiquidityKind.Unbalanced,
                    };

                const txInput: AddLiquidityBoostedTxInput = {
                    client,
                    addLiquidityBoosted,
                    addLiquidityBoostedInput,
                    testAddress,
                    poolStateWithUnderlyings: boostedPool_WBTC_AAVE,
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

            test('with both underlying tokens wrapped', async () => {
                const wethIsEth = false;
                const addLiquidityBoostedInput: AddLiquidityBoostedUnbalancedInput =
                    {
                        chainId,
                        rpcUrl,
                        amountsIn: amountsInForDoubleWrap,
                        kind: AddLiquidityKind.Unbalanced,
                    };

                const txInput: AddLiquidityBoostedTxInput = {
                    client,
                    addLiquidityBoosted,
                    addLiquidityBoostedInput,
                    testAddress,
                    poolStateWithUnderlyings: boostedPool_WBTC_AAVE,
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

            test('with only one underlying token wrapped', async () => {
                const wethIsEth = false;
                const addLiquidityBoostedInput: AddLiquidityBoostedUnbalancedInput =
                    {
                        chainId,
                        rpcUrl,
                        amountsIn: amountsInForSingleWrap,
                        kind: AddLiquidityKind.Unbalanced,
                    };

                const txInput: AddLiquidityBoostedTxInput = {
                    client,
                    addLiquidityBoosted,
                    addLiquidityBoostedInput,
                    testAddress,
                    poolStateWithUnderlyings: boostedPool_WBTC_AAVE,
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

        describe('proportional', () => {
            test('with bpt as reference token', async () => {
                const referenceAmount = {
                    rawAmount: 5000000000000000n,
                    decimals: 18,
                    address: boostedPool_WBTC_AAVE.address,
                };
                const wethIsEth = false;

                const addLiquidityBoostedInput: AddLiquidityBoostedProportionalInput =
                    {
                        chainId,
                        rpcUrl,
                        referenceAmount,
                        tokensIn: tokensInForDoubleWrap,
                        kind: AddLiquidityKind.Proportional,
                    };

                const txInput: AddLiquidityBoostedTxInput = {
                    client,
                    addLiquidityBoosted,
                    addLiquidityBoostedInput,
                    testAddress,
                    poolStateWithUnderlyings: boostedPool_WBTC_AAVE,
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
            test('with underlying as reference token', async () => {
                const referenceAmount = {
                    rawAmount: 200000n,
                    decimals: WBTC.decimals,
                    address: WBTC.address,
                };
                const wethIsEth = false;

                const addLiquidityBoostedInput: AddLiquidityBoostedProportionalInput =
                    {
                        chainId,
                        rpcUrl,
                        referenceAmount,
                        tokensIn: tokensInForDoubleWrap,
                        kind: AddLiquidityKind.Proportional,
                    };

                const txInput: AddLiquidityBoostedTxInput = {
                    client,
                    addLiquidityBoosted,
                    addLiquidityBoostedInput,
                    testAddress,
                    poolStateWithUnderlyings: boostedPool_WBTC_AAVE,
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

            test('with only one underlying token wrapped', async () => {
                const referenceAmount = {
                    rawAmount: 200000n,
                    decimals: WBTC.decimals,
                    address: WBTC.address,
                };
                const wethIsEth = false;

                const addLiquidityBoostedInput: AddLiquidityBoostedProportionalInput =
                    {
                        chainId,
                        rpcUrl,
                        referenceAmount,
                        tokensIn: tokensInForSingleWrap,
                        kind: AddLiquidityKind.Proportional,
                    };
                const txInput: AddLiquidityBoostedTxInput = {
                    client,
                    addLiquidityBoosted,
                    addLiquidityBoostedInput,
                    testAddress,
                    poolStateWithUnderlyings: boostedPool_WBTC_AAVE,
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

    describe('permit 2 signatures', () => {
        describe('add liquidity unbalanced', () => {
            test('token inputs', async () => {
                const input: AddLiquidityBoostedInput = {
                    chainId,
                    rpcUrl,
                    amountsIn: amountsInForDoubleWrap,
                    kind: AddLiquidityKind.Unbalanced,
                };

                const addLiquidityQueryOutput = await addLiquidityBoosted.query(
                    input,
                    boostedPool_WBTC_AAVE,
                );

                const addLiquidityBuildInput = {
                    ...addLiquidityQueryOutput,
                    slippage: Slippage.fromPercentage('1'),
                } as AddLiquidityBoostedBuildCallInput;

                const permit2 =
                    await Permit2Helper.signAddLiquidityBoostedApproval({
                        ...addLiquidityBuildInput,
                        client,
                        owner: testAddress,
                    });

                const addLiquidityBuildCallOutput =
                    await addLiquidityBoosted.buildCallWithPermit2(
                        addLiquidityBuildInput,
                        permit2,
                    );

                const { transactionReceipt, balanceDeltas } =
                    await sendTransactionGetBalances(
                        [
                            addLiquidityQueryOutput.bptOut.token.address,
                            WBTC.address,
                            AAVE.address,
                        ],
                        client,
                        testAddress,
                        addLiquidityBuildCallOutput.to,
                        addLiquidityBuildCallOutput.callData,
                    );

                expect(transactionReceipt.status).to.eq('success');

                expect(addLiquidityQueryOutput.bptOut.amount > 0n).to.be.true;

                areBigIntsWithinPercent(
                    addLiquidityQueryOutput.bptOut.amount,
                    balanceDeltas[0],
                    0.001,
                );

                const slippageAdjustedQueryOutput = Slippage.fromPercentage(
                    '1',
                ).applyTo(addLiquidityQueryOutput.bptOut.amount, -1);

                expect(
                    slippageAdjustedQueryOutput ===
                        addLiquidityBuildCallOutput.minBptOut.amount,
                ).to.be.true;
            });
        });
        describe('proportional', () => {
            test('with tokens', async () => {
                const addLiquidityProportionalInput: AddLiquidityBoostedInput =
                    {
                        chainId,
                        rpcUrl,
                        referenceAmount: {
                            rawAmount: 5000000000000000n,
                            decimals: 18,
                            address: boostedPool_WBTC_AAVE.address,
                        },
                        tokensIn: tokensInForDoubleWrap,
                        kind: AddLiquidityKind.Proportional,
                    };

                const addLiquidityQueryOutput = await addLiquidityBoosted.query(
                    addLiquidityProportionalInput,
                    boostedPool_WBTC_AAVE,
                );
                const addLiquidityBuildInput: AddLiquidityBoostedBuildCallInput =
                    {
                        ...addLiquidityQueryOutput,
                        slippage: Slippage.fromPercentage('1'),
                    };

                const permit2 =
                    await Permit2Helper.signAddLiquidityBoostedApproval({
                        ...addLiquidityBuildInput,
                        client,
                        owner: testAddress,
                    });

                const addLiquidityBuildCallOutput =
                    addLiquidityBoosted.buildCallWithPermit2(
                        addLiquidityBuildInput,
                        permit2,
                    );

                const { transactionReceipt, balanceDeltas } =
                    await sendTransactionGetBalances(
                        [
                            addLiquidityQueryOutput.bptOut.token.address,
                            WBTC.address,
                            AAVE.address,
                        ],
                        client,
                        testAddress,
                        addLiquidityBuildCallOutput.to,
                        addLiquidityBuildCallOutput.callData,
                    );

                expect(transactionReceipt.status).to.eq('success');

                addLiquidityQueryOutput.amountsIn.map((a) => {
                    expect(a.amount > 0n).to.be.true;
                });

                const expectedDeltas = [
                    addLiquidityProportionalInput.referenceAmount.rawAmount,
                    ...addLiquidityQueryOutput.amountsIn.map(
                        (tokenAmount) => tokenAmount.amount,
                    ),
                ];
                expectedDeltas.forEach((delta, i) => {
                    areBigIntsWithinPercent(delta, balanceDeltas[i], 0.001);
                });

                const slippageAdjustedQueryInput =
                    addLiquidityQueryOutput.amountsIn.map((amountsIn) => {
                        return Slippage.fromPercentage('1').applyTo(
                            amountsIn.amount,
                            1,
                        );
                    });
                expect(
                    addLiquidityBuildCallOutput.maxAmountsIn.map(
                        (a) => a.amount,
                    ),
                ).to.deep.eq(slippageAdjustedQueryInput);

                // make sure to pass Tokens in correct order. Same as poolTokens but as underlyings instead
                assertTokenMatch(
                    [
                        new Token(chainId, WBTC.address, WBTC.decimals),
                        new Token(chainId, AAVE.address, AAVE.decimals),
                    ],
                    addLiquidityBuildCallOutput.maxAmountsIn.map(
                        (a) => a.token,
                    ),
                );
            });
        });
    });
});
