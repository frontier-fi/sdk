import { parseEther, parseUnits, TestActions, zeroAddress } from 'viem';
import {
    Address,
    ChainId,
    CreatePoolV3WeightedInput,
    InitPool,
    InitPoolDataProvider,
    PERMIT2,
    Permit2Helper,
    PoolStateWithUnderlyings,
    PoolType,
    PublicWalletClient,
    TokenType,
} from '@/index';
import {
    approveSpenderOnTokens,
    doCreatePool,
    sendTransactionGetBalances,
    setTokenBalances,
    TOKENS,
} from 'test/lib/utils';

const chainId = ChainId.SEPOLIA;
const stataEthAAVE = TOKENS[chainId].stataEthAAVE;
const AAVE = TOKENS[chainId].AAVE;
const WETH = TOKENS[chainId].WETH;

/**
 * Deploys and initializes a 50/50 Weighted partial-boosted pool
 * [stataEthAAVE (ERC4626 -> AAVE), WETH (standard)] in the Frontier Vault on Anvil.
 */
export async function createPartialBoostedPool(
    client: PublicWalletClient & TestActions,
    rpcUrl: string,
    testAddress: Address,
): Promise<PoolStateWithUnderlyings> {
    const createPoolInput: CreatePoolV3WeightedInput = {
        poolType: PoolType.Weighted,
        symbol: '50stataAAVE-50WETH',
        tokens: [
            {
                address: stataEthAAVE.address,
                weight: parseEther('0.5'),
                rateProvider: '0x7c64d1ef668e74aA7fD8955A90A06F0019ee25eB',
                tokenType: TokenType.TOKEN_WITH_RATE,
                paysYieldFees: true,
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
        poolCreator: zeroAddress,
        disableUnbalancedLiquidity: false,
        chainId,
        protocolVersion: 3,
        enableDonation: false,
    };

    const poolAddress = await doCreatePool({
        client,
        testAddress,
        createPoolInput,
    });

    const initPoolDataProvider = new InitPoolDataProvider(chainId, rpcUrl);
    const poolState = await initPoolDataProvider.getInitPoolData(
        poolAddress,
        PoolType.Weighted,
        3,
    );

    await setTokenBalances(
        client,
        testAddress,
        [stataEthAAVE.address, WETH.address],
        [stataEthAAVE.slot!, WETH.slot!],
        [
            parseUnits('1000', stataEthAAVE.decimals),
            parseUnits('10', WETH.decimals),
        ],
    );

    await approveSpenderOnTokens(
        client,
        testAddress,
        [stataEthAAVE.address, WETH.address],
        PERMIT2[chainId],
    );

    const initPoolInput = {
        amountsIn: [
            {
                address: stataEthAAVE.address,
                rawAmount: parseUnits('100', stataEthAAVE.decimals),
                decimals: stataEthAAVE.decimals,
            },
            {
                address: WETH.address,
                rawAmount: parseUnits('1', WETH.decimals),
                decimals: WETH.decimals,
            },
        ],
        minBptAmountOut: 0n,
        chainId,
    };

    const permit2 = await Permit2Helper.signInitPoolApproval({
        ...initPoolInput,
        client,
        owner: testAddress,
    });
    const initPool = new InitPool();
    const initPoolBuildOutput = initPool.buildCallWithPermit2(
        initPoolInput,
        poolState,
        permit2,
    );

    const initTx = await sendTransactionGetBalances(
        [stataEthAAVE.address, WETH.address],
        client,
        testAddress,
        initPoolBuildOutput.to,
        initPoolBuildOutput.callData,
        initPoolBuildOutput.value,
    );
    if (initTx.transactionReceipt.status !== 'success') {
        throw new Error('Failed to initialize partial boosted pool fixture');
    }

    const normalizedPoolAddress = poolAddress.toLowerCase() as Address;

    return {
        id: normalizedPoolAddress,
        address: normalizedPoolAddress,
        type: PoolType.Weighted,
        protocolVersion: 3,
        tokens: [
            {
                index: 0,
                address: stataEthAAVE.address,
                decimals: stataEthAAVE.decimals,
                underlyingToken: {
                    address: AAVE.address,
                    decimals: AAVE.decimals,
                    index: 0,
                },
            },
            {
                index: 1,
                address: WETH.address,
                decimals: WETH.decimals,
                underlyingToken: null,
            },
        ],
    };
}
