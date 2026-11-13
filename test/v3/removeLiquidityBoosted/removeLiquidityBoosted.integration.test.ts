// pnpm test -- removeLiquidityBoosted.integration.test.ts

import { config } from 'dotenv';
config();

import {
    Address,
    createTestClient,
    http,
    parseUnits,
    publicActions,
    TestActions,
    walletActions,
} from 'viem';

import {
    AddLiquidityBoostedInput,
    AddLiquidityKind,
    RemoveLiquidityKind,
    Slippage,
    Hex,
    CHAINS,
    ChainId,
    PERMIT2,
    Token,
    PublicWalletClient,
    AddLiquidityBoostedV3,
    RemoveLiquidityBoostedV3,
    RemoveLiquidityBoostedProportionalInput,
    PermitHelper,
} from 'src';
import {
    doAddLiquidityBoosted,
    setTokenBalances,
    approveSpenderOnTokens,
    approveSpenderOnPermit2,
    sendTransactionGetBalances,
    assertTokenMatch,
    TOKENS,
    areBigIntsWithinPercent,
    AddLiquidityBoostedTxInput,
} from '../../lib/utils';

import { ANVIL_NETWORKS, startFork } from '../../anvil/anvil-global-setup';
import { boostedPool_WBTC_AAVE } from 'test/mockData/boostedPool';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';

const chainId = ChainId.SEPOLIA;
const WBTC = TOKENS[chainId].WBTC;
const AAVE = TOKENS[chainId].AAVE;
const stataAAVE = TOKENS[chainId].stataEthAAVE;

describe('remove liquidity boosted proportional', () => {
    let client: PublicWalletClient & TestActions;
    let rpcUrl: string;
    let snapshot: Hex;
    let testAddress: Address;

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
            [WBTC.address, AAVE.address] as Address[],
            [WBTC.slot, AAVE.slot] as number[],
            [
                parseUnits('10', WBTC.decimals),
                parseUnits('1000', AAVE.decimals),
            ],
        );

        // approve Permit2 to spend user tokens
        // does not include the sub approvals
        await approveSpenderOnTokens(
            client,
            testAddress,
            [WBTC.address, AAVE.address] as Address[],
            PERMIT2[chainId],
        );

        snapshot = await client.snapshot();
    });

    // Add liquidity before each test to prepare for remove liquidity
    beforeEach(async () => {
        await client.revert({
            id: snapshot,
        });
        snapshot = await client.snapshot();

        for (const token of boostedPool_WBTC_AAVE.tokens) {
            await approveSpenderOnPermit2(
                client,
                testAddress,
                token.underlyingToken?.address ?? token.address,
                AddressProvider.CompositeLiquidityRouter(chainId),
            );
        }

        const addLiquidityBoostedInput: AddLiquidityBoostedInput = {
            chainId: chainId,
            rpcUrl: rpcUrl,
            referenceAmount: {
                rawAmount: 10000000000000000n,
                decimals: 18,
                address: boostedPool_WBTC_AAVE.address,
            },
            kind: AddLiquidityKind.Proportional,
            tokensIn: [WBTC.address, AAVE.address],
        };

        const txInput: AddLiquidityBoostedTxInput = {
            client,
            addLiquidityBoosted: new AddLiquidityBoostedV3(),
            addLiquidityBoostedInput,
            testAddress,
            poolStateWithUnderlyings: boostedPool_WBTC_AAVE,
            slippage: Slippage.fromPercentage('1'),
            wethIsEth: false,
        };

        await doAddLiquidityBoosted(txInput);
    });

    test('query returns correct token addresses', async () => {
        const removeLiquidityBoostedV3 = new RemoveLiquidityBoostedV3();

        const removeLiquidityInput: RemoveLiquidityBoostedProportionalInput = {
            chainId: chainId,
            rpcUrl: rpcUrl,
            bptIn: {
                rawAmount: 5000000000000000n,
                decimals: 18,
                address: boostedPool_WBTC_AAVE.address,
            },
            tokensOut: [WBTC.address, stataAAVE.address],
            kind: RemoveLiquidityKind.Proportional,
        };

        const removeLiquidityQueryOutput = await removeLiquidityBoostedV3.query(
            removeLiquidityInput,
            boostedPool_WBTC_AAVE,
        );

        const amountsOut = removeLiquidityQueryOutput.amountsOut;

        expect(amountsOut[0].token.address).to.eq(WBTC.address.toLowerCase());
        expect(amountsOut[1].token.address).to.eq(
            stataAAVE.address.toLowerCase(),
        );
    });

    describe('direct approval', () => {
        beforeEach(async () => {
            // Approve the Composite liquidity router.
            await approveSpenderOnTokens(
                client,
                testAddress,
                [boostedPool_WBTC_AAVE.address] as Address[],
                AddressProvider.CompositeLiquidityRouter(chainId),
            );
        });
        test('unwrap both tokens', async () => {
            const removeLiquidityBoostedV3 = new RemoveLiquidityBoostedV3();

            const removeLiquidityInput: RemoveLiquidityBoostedProportionalInput =
                {
                    chainId: chainId,
                    rpcUrl: rpcUrl,
                    bptIn: {
                        rawAmount: 5000000000000000n,
                        decimals: 18,
                        address: boostedPool_WBTC_AAVE.address,
                    },
                    tokensOut: [WBTC.address, AAVE.address],
                    kind: RemoveLiquidityKind.Proportional,
                };

            const removeLiquidityQueryOutput =
                await removeLiquidityBoostedV3.query(
                    removeLiquidityInput,
                    boostedPool_WBTC_AAVE,
                );

            const removeLiquidityBuildInput = {
                ...removeLiquidityQueryOutput,
                slippage: Slippage.fromPercentage('1'),
            };

            const removeLiquidityBuildCallOutput =
                removeLiquidityBoostedV3.buildCall(removeLiquidityBuildInput);

            const { transactionReceipt, balanceDeltas } =
                await sendTransactionGetBalances(
                    [boostedPool_WBTC_AAVE.address, WBTC.address, AAVE.address],
                    client,
                    testAddress,
                    removeLiquidityBuildCallOutput.to,
                    removeLiquidityBuildCallOutput.callData,
                );
            expect(transactionReceipt.status).to.eq('success');
            expect(
                removeLiquidityQueryOutput.amountsOut.map((amount) => {
                    expect(amount.amount > 0).to.be.true;
                }),
            );

            const expectedDeltas = [
                removeLiquidityQueryOutput.bptIn.amount,
                ...removeLiquidityQueryOutput.amountsOut.map(
                    (amountOut) => amountOut.amount,
                ),
            ];
            // Here we check that output diff is within an acceptable tolerance as buffers can have difference in queries/result
            expectedDeltas.forEach((delta, i) => {
                areBigIntsWithinPercent(delta, balanceDeltas[i], 0.001);
            });
            const expectedMinAmountsOut =
                removeLiquidityQueryOutput.amountsOut.map((amountOut) =>
                    removeLiquidityBuildInput.slippage.applyTo(
                        amountOut.amount,
                        -1,
                    ),
                );
            expect(expectedMinAmountsOut).to.deep.eq(
                removeLiquidityBuildCallOutput.minAmountsOut.map(
                    (a) => a.amount,
                ),
            );

            // make sure to pass Tokens in correct order. Same as poolTokens but as underlyings instead
            assertTokenMatch(
                [
                    new Token(chainId, WBTC.address as Address, WBTC.decimals),
                    new Token(chainId, AAVE.address as Address, AAVE.decimals),
                ],
                removeLiquidityBuildCallOutput.minAmountsOut.map(
                    (a) => a.token,
                ),
            );
        });

        test('unwrap only one token', async () => {
            const removeLiquidityBoostedV3 = new RemoveLiquidityBoostedV3();

            const removeLiquidityInput: RemoveLiquidityBoostedProportionalInput =
                {
                    chainId: chainId,
                    rpcUrl: rpcUrl,
                    bptIn: {
                        rawAmount: 5000000000000000n,
                        decimals: 18,
                        address: boostedPool_WBTC_AAVE.address,
                    },
                    tokensOut: [WBTC.address, stataAAVE.address],
                    kind: RemoveLiquidityKind.Proportional,
                };

            const removeLiquidityQueryOutput =
                await removeLiquidityBoostedV3.query(
                    removeLiquidityInput,
                    boostedPool_WBTC_AAVE,
                );

            const removeLiquidityBuildInput = {
                ...removeLiquidityQueryOutput,
                slippage: Slippage.fromPercentage('1'),
            };

            const removeLiquidityBuildCallOutput =
                removeLiquidityBoostedV3.buildCall(removeLiquidityBuildInput);

            const { transactionReceipt, balanceDeltas } =
                await sendTransactionGetBalances(
                    [
                        boostedPool_WBTC_AAVE.address,
                        WBTC.address,
                        stataAAVE.address,
                    ],
                    client,
                    testAddress,
                    removeLiquidityBuildCallOutput.to,
                    removeLiquidityBuildCallOutput.callData,
                );
            expect(transactionReceipt.status).to.eq('success');
            expect(
                removeLiquidityQueryOutput.amountsOut.map((amount) => {
                    expect(amount.amount > 0).to.be.true;
                }),
            );

            const expectedDeltas = [
                removeLiquidityQueryOutput.bptIn.amount,
                ...removeLiquidityQueryOutput.amountsOut.map(
                    (amountOut) => amountOut.amount,
                ),
            ];
            // Here we check that output diff is within an acceptable tolerance as buffers can have difference in queries/result
            expectedDeltas.forEach((delta, i) => {
                areBigIntsWithinPercent(delta, balanceDeltas[i], 0.001);
            });
            const expectedMinAmountsOut =
                removeLiquidityQueryOutput.amountsOut.map((amountOut) =>
                    removeLiquidityBuildInput.slippage.applyTo(
                        amountOut.amount,
                        -1,
                    ),
                );
            expect(expectedMinAmountsOut).to.deep.eq(
                removeLiquidityBuildCallOutput.minAmountsOut.map(
                    (a) => a.amount,
                ),
            );

            // make sure to pass Tokens in correct order
            assertTokenMatch(
                [
                    new Token(chainId, WBTC.address as Address, WBTC.decimals),
                    new Token(
                        chainId,
                        stataAAVE.address as Address,
                        stataAAVE.decimals,
                    ),
                ],
                removeLiquidityBuildCallOutput.minAmountsOut.map(
                    (a) => a.token,
                ),
            );
        });
    });
    describe('permit approval', () => {
        test('remove liquidity proportional', async () => {
            const removeLiquidityBoostedV3 = new RemoveLiquidityBoostedV3();

            const removeLiquidityInput: RemoveLiquidityBoostedProportionalInput =
                {
                    chainId: chainId,
                    rpcUrl: rpcUrl,
                    bptIn: {
                        rawAmount: 5000000000000000n,
                        decimals: 18,
                        address: boostedPool_WBTC_AAVE.address,
                    },
                    tokensOut: [WBTC.address, AAVE.address],
                    kind: RemoveLiquidityKind.Proportional,
                    sender: testAddress,
                    userData: '0x123',
                };

            const removeLiquidityQueryOutput =
                await removeLiquidityBoostedV3.query(
                    removeLiquidityInput,
                    boostedPool_WBTC_AAVE,
                );

            const removeLiquidityBuildInput = {
                ...removeLiquidityQueryOutput,
                slippage: Slippage.fromPercentage('1'),
            };

            const permit =
                await PermitHelper.signRemoveLiquidityBoostedApproval({
                    ...removeLiquidityBuildInput,
                    client,
                    owner: testAddress,
                });

            const removeLiquidityBuildCallOutput =
                removeLiquidityBoostedV3.buildCallWithPermit(
                    removeLiquidityBuildInput,
                    permit,
                );

            const { transactionReceipt, balanceDeltas } =
                await sendTransactionGetBalances(
                    [boostedPool_WBTC_AAVE.address, WBTC.address, AAVE.address],
                    client,
                    testAddress,
                    removeLiquidityBuildCallOutput.to,
                    removeLiquidityBuildCallOutput.callData,
                );

            expect(transactionReceipt.status).to.eq('success');
            expect(
                removeLiquidityQueryOutput.amountsOut.map((amount) => {
                    expect(amount.amount > 0).to.be.true;
                }),
            );

            const expectedDeltas = [
                removeLiquidityQueryOutput.bptIn.amount,
                ...removeLiquidityQueryOutput.amountsOut.map(
                    (amountOut) => amountOut.amount,
                ),
            ];
            expectedDeltas.forEach((delta, i) => {
                areBigIntsWithinPercent(delta, balanceDeltas[i], 0.001);
            });
            const expectedMinAmountsOut =
                removeLiquidityQueryOutput.amountsOut.map((amountOut) =>
                    removeLiquidityBuildInput.slippage.applyTo(
                        amountOut.amount,
                        -1,
                    ),
                );
            expect(expectedMinAmountsOut).to.deep.eq(
                removeLiquidityBuildCallOutput.minAmountsOut.map(
                    (a) => a.amount,
                ),
            );
            // make sure to pass Tokens in correct order. Same as poolTokens but as underlyings instead
            assertTokenMatch(
                [
                    new Token(chainId, WBTC.address as Address, WBTC.decimals),
                    new Token(chainId, AAVE.address as Address, AAVE.decimals),
                ],
                removeLiquidityBuildCallOutput.minAmountsOut.map(
                    (a) => a.token,
                ),
            );
        });
    });
});
