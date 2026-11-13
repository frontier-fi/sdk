// pnpm test -- swapV3.integration.test.ts
import { config } from 'dotenv';
config();
import {
    Address,
    createTestClient,
    http,
    parseEther,
    parseUnits,
    publicActions,
    walletActions,
    TestActions,
    Hex,
    zeroAddress,
} from 'viem';
import {
    AddLiquidity,
    AddLiquidityKind,
    CHAINS,
    ChainId,
    CreatePoolV3WeightedInput,
    InitPool,
    InitPoolDataProvider,
    Permit2Helper,
    PoolState,
    PoolType,
    Slippage,
    SwapKind,
    Swap,
    PERMIT2,
    PublicWalletClient,
    TokenType,
} from '@/index';
import { Path } from '@/entities/swap/paths/types';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';

import {
    approveSpenderOnTokens,
    approveTokens,
    doCreatePool,
    sendTransactionGetBalances,
    setTokenBalances,
} from 'test/lib/utils';
import { ANVIL_NETWORKS, startFork } from 'test/anvil/anvil-global-setup';
import { POOLS, TOKENS } from 'test/lib/utils/addresses';
import {
    assertSwapExactIn,
    assertSwapExactOut,
} from 'test/lib/utils/swapHelpers';

const protocolVersion = 3;
const chainId = ChainId.SEPOLIA;

const WETH = TOKENS[chainId].WETH;
const USDC = TOKENS[chainId].USDC_AAVE;
const TOK0 = TOKENS[chainId].TOK0;
const TOK1 = TOKENS[chainId].TOK1;
const WBTC = TOKENS[chainId].WBTC;
const AAVE = TOKENS[chainId].AAVE;
const TOK1_USDC_BPT = POOLS[chainId].MOCK_TOK1_USDC_POOL;
const boosted_pool = POOLS[chainId].MOCK_BOOSTED_POOL;
const stataEthWBTC = TOKENS[chainId].stataEthWBTC;
const stataEthAAVE = TOKENS[chainId].stataEthAAVE;

describe('SwapV3', () => {
    let client: PublicWalletClient & TestActions;
    let testAddress: Address;
    let rpcUrl: string;
    let snapshot: Hex;
    let pathBalWeth: Path;
    let pathMultiSwap: Path;
    let pathUsdcWethMulti: Path;
    let pathWithExit: Path;
    let pathUsdcWethJoin: Path;
    let tokens: Address[];

    beforeAll(async () => {
        const fork = await startFork(ANVIL_NETWORKS.SEPOLIA);
        rpcUrl = fork.rpcUrl;
        client = createTestClient({
            mode: 'anvil',
            chain: CHAINS[chainId],
            transport: http(rpcUrl),
        })
            .extend(publicActions)
            .extend(walletActions);

        testAddress = (await client.getAddresses())[0];

        tokens = [
            WETH.address,
            TOK0.address,
            TOK1.address,
            USDC.address,
            WBTC.address,
            AAVE.address,
        ];

        await setTokenBalances(
            client,
            testAddress,
            tokens,
            [
                WETH.slot,
                TOK0.slot,
                TOK1.slot,
                USDC.slot,
                WBTC.slot,
                AAVE.slot,
            ] as number[],
            [
                parseEther('100'),
                parseEther('10000'),
                parseEther('10000'),
                parseUnits('100000', USDC.decimals),
                parseUnits('10', WBTC.decimals),
                parseEther('1000'),
            ],
        );

        await approveSpenderOnTokens(
            client,
            testAddress,
            tokens,
            PERMIT2[chainId],
        );

        // Mint MOCK_TOK1_USDC_POOL BPT and deploy/initialize a 50/50 Weighted [BPT, WETH] nested pool
        // on the Frontier Vault so multi-hop join/exit paths execute against Frontier contracts.
        const tok1UsdcPoolState: PoolState = {
            id: TOK1_USDC_BPT.id,
            address: TOK1_USDC_BPT.address,
            type: PoolType.Weighted,
            protocolVersion,
            tokens: [
                {
                    address: TOK1.address,
                    decimals: TOK1.decimals,
                    index: 0,
                },
                {
                    address: USDC.address,
                    decimals: USDC.decimals,
                    index: 1,
                },
            ],
        };
        const addLiquidity = new AddLiquidity();
        const addLiquidityQuery = await addLiquidity.query(
            {
                chainId,
                rpcUrl,
                kind: AddLiquidityKind.Unbalanced,
                amountsIn: [
                    {
                        address: TOK1.address,
                        decimals: TOK1.decimals,
                        rawAmount: parseEther('200'),
                    },
                    {
                        address: USDC.address,
                        decimals: USDC.decimals,
                        rawAmount: parseUnits('200', USDC.decimals),
                    },
                ],
            },
            tok1UsdcPoolState,
        );
        const addLiquidityBuildInput = {
            ...addLiquidityQuery,
            slippage: Slippage.fromPercentage('1'),
            chainId,
            protocolVersion: 3 as const,
            userData: '0x' as const,
        };
        const addPermit2 = await Permit2Helper.signAddLiquidityApproval({
            ...addLiquidityBuildInput,
            client,
            owner: testAddress,
        });
        const addCall = addLiquidity.buildCallWithPermit2(
            addLiquidityBuildInput,
            addPermit2,
        );
        await sendTransactionGetBalances(
            [TOK1_USDC_BPT.address],
            client,
            testAddress,
            addCall.to,
            addCall.callData,
            addCall.value,
        );

        const createNestedPoolInput: CreatePoolV3WeightedInput = {
            poolType: PoolType.Weighted,
            symbol: '50BPT-50WETH',
            tokens: [
                {
                    address: TOK1_USDC_BPT.address,
                    weight: parseEther('0.5'),
                    rateProvider: zeroAddress,
                    tokenType: TokenType.STANDARD,
                    paysYieldFees: false,
                },
                {
                    address: WETH.address,
                    weight: parseEther('0.5'),
                    rateProvider: zeroAddress,
                    tokenType: TokenType.STANDARD,
                    paysYieldFees: false,
                },
            ],
            swapFeePercentage: parseEther('0.003'),
            poolHooksContract: zeroAddress,
            pauseManager: testAddress,
            swapFeeManager: testAddress,
            poolCreator: testAddress,
            disableUnbalancedLiquidity: false,
            chainId,
            protocolVersion,
            enableDonation: false,
        };
        const nestedPoolAddress = (
            await doCreatePool({
                client,
                testAddress,
                createPoolInput: createNestedPoolInput,
            })
        ).toLowerCase() as Address;
        await approveSpenderOnTokens(
            client,
            testAddress,
            [TOK1_USDC_BPT.address],
            PERMIT2[chainId],
        );
        const initPoolDataProvider = new InitPoolDataProvider(chainId, rpcUrl);
        const nestedPoolState = await initPoolDataProvider.getInitPoolData(
            nestedPoolAddress,
            PoolType.Weighted,
            protocolVersion,
        );
        const initNestedInput = {
            amountsIn: [
                {
                    address: TOK1_USDC_BPT.address,
                    rawAmount: parseEther('100'),
                    decimals: TOK1_USDC_BPT.decimals,
                },
                {
                    address: WETH.address,
                    rawAmount: parseEther('0.1'),
                    decimals: WETH.decimals,
                },
            ],
            minBptAmountOut: 0n,
            chainId,
        };
        const initPermit2 = await Permit2Helper.signInitPoolApproval({
            ...initNestedInput,
            client,
            owner: testAddress,
        });
        const initCall = new InitPool().buildCallWithPermit2(
            initNestedInput,
            nestedPoolState,
            initPermit2,
        );
        await sendTransactionGetBalances(
            [TOK1_USDC_BPT.address, WETH.address],
            client,
            testAddress,
            initCall.to,
            initCall.callData,
            initCall.value,
        );

        // tok0 [swap] weth
        pathBalWeth = {
            protocolVersion,
            tokens: [
                {
                    address: TOK0.address,
                    decimals: TOK0.decimals,
                },
                {
                    address: WETH.address,
                    decimals: WETH.decimals,
                },
            ],
            pools: [POOLS[chainId].MOCK_WETH_TOK0_POOL.id],
            inputAmountRaw: 100000000000000n,
            outputAmountRaw: 100000000000000n,
        };

        // weth [swap] tok0 [swap] tok1 [swap] usdc
        pathMultiSwap = {
            protocolVersion,
            tokens: [
                {
                    address: WETH.address,
                    decimals: WETH.decimals,
                },
                {
                    address: TOK0.address,
                    decimals: TOK0.decimals,
                },
                {
                    address: TOK1.address,
                    decimals: TOK1.decimals,
                },
                {
                    address: USDC.address,
                    decimals: USDC.decimals,
                },
            ],
            pools: [
                POOLS[chainId].MOCK_WETH_TOK0_POOL.id,
                POOLS[chainId].MOCK_TOK0_TOK1_POOL.id,
                POOLS[chainId].MOCK_TOK1_USDC_POOL.id,
            ],
            inputAmountRaw: 100000000000000n,
            outputAmountRaw: 100000n,
        };

        // usdc [swap] tok1 [swap] tok0 [swap] weth
        pathUsdcWethMulti = {
            ...pathMultiSwap,
            tokens: [...pathMultiSwap.tokens].reverse(),
            pools: [...pathMultiSwap.pools].reverse(),
            inputAmountRaw: 100000n,
            outputAmountRaw: 40000000000000n,
        };

        // weth [swap] bpt [exit] usdc
        pathWithExit = {
            protocolVersion,
            tokens: [
                {
                    address: WETH.address,
                    decimals: WETH.decimals,
                },
                {
                    address: TOK1_USDC_BPT.address,
                    decimals: TOK1_USDC_BPT.decimals,
                },
                {
                    address: USDC.address,
                    decimals: USDC.decimals,
                },
            ],
            pools: [nestedPoolAddress, POOLS[chainId].MOCK_TOK1_USDC_POOL.id],
            inputAmountRaw: 100000000000000n,
            outputAmountRaw: 100000n,
        };

        // usdc [join] bpt [swap] weth
        pathUsdcWethJoin = {
            ...pathWithExit,
            tokens: [...pathWithExit.tokens].reverse(),
            pools: [...pathWithExit.pools].reverse(),
            inputAmountRaw: 100000n,
            outputAmountRaw: 40000000000000n,
        };

        await setTokenBalances(
            client,
            testAddress,
            tokens,
            [
                WETH.slot,
                TOK0.slot,
                TOK1.slot,
                USDC.slot,
                WBTC.slot,
                AAVE.slot,
            ] as number[],
            [
                parseEther('100'),
                parseEther('10000'),
                parseEther('10000'),
                parseUnits('100000', USDC.decimals),
                parseUnits('10', WBTC.decimals),
                parseEther('1000'),
            ],
        );

        // Uses Special RPC methods to revert state back to same snapshot for each test
        // https://github.com/trufflesuite/ganache-cli-archive/blob/master/README.md
        snapshot = await client.snapshot();
    });

    beforeEach(async () => {
        await client.revert({
            id: snapshot,
        });
        snapshot = await client.snapshot();
    });

    describe('permit2 direct approval', () => {
        beforeEach(async () => {
            await approveTokens(client, testAddress, tokens, protocolVersion);
        });
        describe('single swap', () => {
            describe('swap should be executed correctly', () => {
                describe('wethIsEth: false', () => {
                    test('GivenIn', async () => {
                        const swap = new Swap({
                            chainId,
                            paths: [pathBalWeth],
                            swapKind: SwapKind.GivenIn,
                        });
                        await assertSwapExactIn({
                            contractToCall: AddressProvider.Router(chainId),
                            client,
                            rpcUrl,
                            chainId,
                            swap,
                            wethIsEth: false,
                        });
                    });
                    test('GivenOut', async () => {
                        const swap = new Swap({
                            chainId,
                            paths: [pathBalWeth],
                            swapKind: SwapKind.GivenOut,
                        });
                        await assertSwapExactOut({
                            contractToCall: AddressProvider.Router(chainId),
                            client,
                            rpcUrl,
                            chainId,
                            swap,
                            wethIsEth: false,
                        });
                    });
                });
                describe('wethIsEth: true', () => {
                    describe('eth out', async () => {
                        test('GivenIn', async () => {
                            const swap = new Swap({
                                chainId,
                                paths: [pathBalWeth],
                                swapKind: SwapKind.GivenIn,
                            });
                            await assertSwapExactIn({
                                contractToCall: AddressProvider.Router(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap,
                                wethIsEth: true,
                            });
                        });
                        test('GivenOut', async () => {
                            const swap = new Swap({
                                chainId,
                                paths: [pathBalWeth],
                                swapKind: SwapKind.GivenOut,
                            });
                            await assertSwapExactOut({
                                contractToCall: AddressProvider.Router(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap,
                                wethIsEth: true,
                            });
                        });
                    });
                    describe('eth in', () => {
                        test('GivenIn', async () => {
                            const pathWethBal = {
                                ...pathBalWeth,
                                tokens: [...pathBalWeth.tokens].reverse(),
                            };
                            const swap = new Swap({
                                chainId,
                                paths: [pathWethBal],
                                swapKind: SwapKind.GivenIn,
                            });
                            await assertSwapExactIn({
                                contractToCall: AddressProvider.Router(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap,
                                wethIsEth: true,
                            });
                        });
                        test('GivenOut', async () => {
                            const pathWethBal = {
                                ...pathBalWeth,
                                tokens: [...pathBalWeth.tokens].reverse(),
                            };
                            const swap = new Swap({
                                chainId,
                                paths: [pathWethBal],
                                swapKind: SwapKind.GivenOut,
                            });
                            await assertSwapExactOut({
                                contractToCall: AddressProvider.Router(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap,
                                wethIsEth: true,
                            });
                        });
                    });
                });
            });
        });

        describe('multi-hop swap', () => {
            describe('swap should be executed correctly', () => {
                describe('path with swaps only', () => {
                    describe('wethIsEth: false', () => {
                        const wethIsEth = false;
                        test('GivenIn', async () => {
                            await assertSwapExactIn({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap: new Swap({
                                    chainId,
                                    paths: [pathMultiSwap],
                                    swapKind: SwapKind.GivenIn,
                                }),
                                wethIsEth,
                            });
                        });
                        test('GivenOut', async () => {
                            await assertSwapExactOut({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap: new Swap({
                                    chainId,
                                    paths: [pathMultiSwap],
                                    swapKind: SwapKind.GivenOut,
                                }),
                                wethIsEth,
                            });
                        });
                    });
                    describe('wethIsEth: true', () => {
                        const wethIsEth = true;
                        describe('eth in', async () => {
                            test('GivenIn', async () => {
                                await assertSwapExactIn({
                                    contractToCall:
                                        AddressProvider.BatchRouter(chainId),
                                    client,
                                    rpcUrl,
                                    chainId,
                                    swap: new Swap({
                                        chainId,
                                        paths: [pathMultiSwap],
                                        swapKind: SwapKind.GivenIn,
                                    }),
                                    wethIsEth,
                                });
                            });
                            test('GivenOut', async () => {
                                await assertSwapExactOut({
                                    contractToCall:
                                        AddressProvider.BatchRouter(chainId),
                                    client,
                                    rpcUrl,
                                    chainId,
                                    swap: new Swap({
                                        chainId,
                                        paths: [pathMultiSwap],
                                        swapKind: SwapKind.GivenOut,
                                    }),
                                    wethIsEth,
                                });
                            });
                        });
                        describe('eth out', () => {
                            test('GivenIn', async () => {
                                const swap = new Swap({
                                    chainId,
                                    paths: [pathUsdcWethMulti],
                                    swapKind: SwapKind.GivenIn,
                                });
                                await assertSwapExactIn({
                                    contractToCall:
                                        AddressProvider.BatchRouter(chainId),
                                    client,
                                    rpcUrl,
                                    chainId,
                                    swap,
                                    wethIsEth,
                                });
                            });
                            test('GivenOut', async () => {
                                const swap = new Swap({
                                    chainId,
                                    paths: [pathUsdcWethMulti],
                                    swapKind: SwapKind.GivenOut,
                                });
                                await assertSwapExactOut({
                                    contractToCall:
                                        AddressProvider.BatchRouter(chainId),
                                    client,
                                    rpcUrl,
                                    chainId,
                                    swap,
                                    wethIsEth,
                                });
                            });
                        });
                    });
                });
                describe('paths with exit/join', () => {
                    describe('wethIsEth: false', () => {
                        test('GivenIn', async () => {
                            const swap = new Swap({
                                chainId,
                                paths: [pathMultiSwap, pathWithExit],
                                swapKind: SwapKind.GivenIn,
                            });
                            await assertSwapExactIn({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap,
                                wethIsEth: false,
                            });
                        });
                        test('GivenOut', async () => {
                            const swap = new Swap({
                                chainId,
                                paths: [pathMultiSwap, pathWithExit],
                                swapKind: SwapKind.GivenOut,
                            });
                            await assertSwapExactOut({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap,
                                wethIsEth: false,
                            });
                        });
                    });
                    describe('wethIsEth: true', () => {
                        describe('eth in', async () => {
                            test('GivenIn', async () => {
                                const swap = new Swap({
                                    chainId,
                                    paths: [pathMultiSwap, pathWithExit],
                                    swapKind: SwapKind.GivenIn,
                                });
                                await assertSwapExactIn({
                                    contractToCall:
                                        AddressProvider.BatchRouter(chainId),
                                    client,
                                    rpcUrl,
                                    chainId,
                                    swap,
                                    wethIsEth: true,
                                });
                            });
                            test('GivenOut', async () => {
                                const swap = new Swap({
                                    chainId,
                                    paths: [pathMultiSwap, pathWithExit],
                                    swapKind: SwapKind.GivenOut,
                                });
                                await assertSwapExactOut({
                                    contractToCall:
                                        AddressProvider.BatchRouter(chainId),
                                    client,
                                    rpcUrl,
                                    chainId,
                                    swap,
                                    wethIsEth: true,
                                });
                            });
                        });
                        describe('eth out', () => {
                            test('GivenIn', async () => {
                                const swap = new Swap({
                                    chainId,
                                    paths: [
                                        pathUsdcWethMulti,
                                        pathUsdcWethJoin,
                                    ],
                                    swapKind: SwapKind.GivenIn,
                                });
                                await assertSwapExactIn({
                                    contractToCall:
                                        AddressProvider.BatchRouter(chainId),
                                    client,
                                    rpcUrl,
                                    chainId,
                                    swap,
                                    wethIsEth: true,
                                });
                            });
                            test('GivenOut', async () => {
                                const swap = new Swap({
                                    chainId,
                                    paths: [
                                        pathUsdcWethMulti,
                                        pathUsdcWethJoin,
                                    ],
                                    swapKind: SwapKind.GivenOut,
                                });
                                await assertSwapExactOut({
                                    contractToCall:
                                        AddressProvider.BatchRouter(chainId),
                                    client,
                                    rpcUrl,
                                    chainId,
                                    swap,
                                    wethIsEth: true,
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    describe('permit2 signatures', () => {
        const usePermit2Signatures = true;
        describe('single swap', () => {
            describe('swap should be executed correctly', () => {
                describe('wethIsEth: false', () => {
                    test('GivenIn', async () => {
                        const swap = new Swap({
                            chainId,
                            paths: [pathBalWeth],
                            swapKind: SwapKind.GivenIn,
                        });
                        await assertSwapExactIn({
                            contractToCall: AddressProvider.Router(chainId),
                            client,
                            rpcUrl,
                            chainId,
                            swap,
                            wethIsEth: false,
                            usePermit2Signatures,
                        });
                    });
                    test('GivenOut', async () => {
                        const swap = new Swap({
                            chainId,
                            paths: [pathBalWeth],
                            swapKind: SwapKind.GivenOut,
                        });
                        await assertSwapExactOut({
                            contractToCall: AddressProvider.Router(chainId),
                            client,
                            rpcUrl,
                            chainId,
                            swap,
                            wethIsEth: false,
                            usePermit2Signatures,
                        });
                    });
                });
                describe('wethIsEth: true', () => {
                    test('GivenIn', async () => {
                        const swap = new Swap({
                            chainId,
                            paths: [pathBalWeth],
                            swapKind: SwapKind.GivenIn,
                        });
                        await assertSwapExactIn({
                            contractToCall: AddressProvider.Router(chainId),
                            client,
                            rpcUrl,
                            chainId,
                            swap,
                            wethIsEth: true,
                            usePermit2Signatures,
                        });
                    });
                    test('GivenOut', async () => {
                        const swap = new Swap({
                            chainId,
                            paths: [pathBalWeth],
                            swapKind: SwapKind.GivenOut,
                        });
                        await assertSwapExactOut({
                            contractToCall: AddressProvider.Router(chainId),
                            client,
                            rpcUrl,
                            chainId,
                            swap,
                            wethIsEth: true,
                            usePermit2Signatures,
                        });
                    });
                });
            });
        });

        describe('multi-hop swap', () => {
            describe('swap should be executed correctly', () => {
                describe('path with swaps only', () => {
                    describe('wethIsEth: false', () => {
                        test('GivenIn', async () => {
                            await assertSwapExactIn({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap: new Swap({
                                    chainId,
                                    paths: [pathMultiSwap],
                                    swapKind: SwapKind.GivenIn,
                                }),
                                wethIsEth: false,
                                usePermit2Signatures,
                            });
                        });
                        test('GivenOut', async () => {
                            await assertSwapExactOut({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap: new Swap({
                                    chainId,
                                    paths: [pathMultiSwap],
                                    swapKind: SwapKind.GivenOut,
                                }),
                                wethIsEth: false,
                                usePermit2Signatures,
                            });
                        });
                    });
                    describe('wethIsEth: true', () => {
                        test('GivenIn', async () => {
                            await assertSwapExactIn({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap: new Swap({
                                    chainId,
                                    paths: [pathMultiSwap],
                                    swapKind: SwapKind.GivenIn,
                                }),
                                wethIsEth: true,
                                usePermit2Signatures,
                            });
                        });
                        test('GivenOut', async () => {
                            await assertSwapExactOut({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap: new Swap({
                                    chainId,
                                    paths: [pathMultiSwap],
                                    swapKind: SwapKind.GivenOut,
                                }),
                                wethIsEth: true,
                                usePermit2Signatures,
                            });
                        });
                    });
                });
                describe('paths with exit/join', () => {
                    describe('wethIsEth: false', () => {
                        test('GivenIn', async () => {
                            const swap = new Swap({
                                chainId,
                                paths: [pathMultiSwap, pathWithExit],
                                swapKind: SwapKind.GivenIn,
                            });
                            await assertSwapExactIn({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap,
                                wethIsEth: false,
                                usePermit2Signatures,
                            });
                        });
                        test('GivenOut', async () => {
                            const swap = new Swap({
                                chainId,
                                paths: [pathMultiSwap, pathWithExit],
                                swapKind: SwapKind.GivenOut,
                            });
                            await assertSwapExactOut({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap,
                                wethIsEth: false,
                                usePermit2Signatures,
                            });
                        });
                    });
                    describe('wethIsEth: true', () => {
                        test('GivenIn', async () => {
                            const swap = new Swap({
                                chainId,
                                paths: [pathMultiSwap, pathWithExit],
                                swapKind: SwapKind.GivenIn,
                            });
                            await assertSwapExactIn({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap,
                                wethIsEth: true,
                                usePermit2Signatures,
                            });
                        });
                        test('GivenOut', async () => {
                            const swap = new Swap({
                                chainId,
                                paths: [pathMultiSwap, pathWithExit],
                                swapKind: SwapKind.GivenOut,
                            });
                            await assertSwapExactOut({
                                contractToCall:
                                    AddressProvider.BatchRouter(chainId),
                                client,
                                rpcUrl,
                                chainId,
                                swap,
                                wethIsEth: true,
                                usePermit2Signatures,
                            });
                        });
                    });
                });
            });
        });
    });

    describe('boosted', () => {
        describe('multi-hop swap', () => {
            // WBTC[wrap]stataEthWBTC[swap]stataEthAAVE[unwrap]AAVE
            const pathWithBuffers = {
                protocolVersion: 3,
                tokens: [
                    {
                        address: WBTC.address,
                        decimals: WBTC.decimals,
                    },
                    {
                        address: stataEthWBTC.address,
                        decimals: stataEthWBTC.decimals,
                    },
                    {
                        address: stataEthAAVE.address,
                        decimals: stataEthAAVE.decimals,
                    },
                    {
                        address: AAVE.address,
                        decimals: AAVE.decimals,
                    },
                ],
                pools: [
                    stataEthWBTC.address,
                    boosted_pool.address,
                    stataEthAAVE.address,
                ],
                isBuffer: [true, false, true],
            };

            describe('swap should be executed correctly', () => {
                beforeEach(async () => {
                    await approveTokens(
                        client,
                        testAddress,
                        tokens,
                        protocolVersion,
                    );
                });
                test('GivenIn', async () => {
                    const swap = new Swap({
                        chainId,
                        paths: [
                            {
                                ...pathWithBuffers,
                                inputAmountRaw: 100000n,
                                outputAmountRaw: 0n,
                            } as Path,
                        ],
                        swapKind: SwapKind.GivenIn,
                    });
                    // Buffers can have a small difference due to rates so we don't check for 100% match between result and query
                    await assertSwapExactIn({
                        contractToCall: AddressProvider.BatchRouter(chainId),
                        client,
                        rpcUrl,
                        chainId,
                        swap,
                        wethIsEth: false,
                        outputTest: {
                            testExactOutAmount: false,
                            percentage: 0.001,
                        },
                    });
                });
                test('GivenOut', async () => {
                    const swap = new Swap({
                        chainId,
                        paths: [
                            {
                                ...pathWithBuffers,
                                inputAmountRaw: 0n,
                                outputAmountRaw: 100000000000000000n,
                            } as Path,
                        ],
                        swapKind: SwapKind.GivenOut,
                    });
                    await assertSwapExactOut({
                        contractToCall: AddressProvider.BatchRouter(chainId),
                        client,
                        rpcUrl,
                        chainId,
                        swap,
                        wethIsEth: false,
                        inputTest: {
                            testExactInAmount: false,
                            percentage: 0.001,
                        },
                    });
                });
            });
        });
    });
});
