/**
 * Example showing how to add liquidity to a pool.
 * (Runs against a local Anvil fork)
 *
 * Run with:
 * pnpm example ./examples/addLiquidity/addLiquidityBuffer.ts
 */
import {
    Address,
    createTestClient,
    http,
    parseUnits,
    publicActions,
    walletActions,
} from 'viem';
import {
    FrontierApi,
    ChainId,
    Slippage,
    TEST_API_ENDPOINT,
    CHAINS,
    AddLiquidityBufferInput,
    AddLiquidityBufferV3,
    PERMIT2,
} from '../../src';
import { ANVIL_NETWORKS, startFork } from '../../test/anvil/anvil-global-setup';
import {
    approveSpenderOnPermit2,
    approveSpenderOnTokens,
    sendTransactionGetBalances,
    setTokenBalances,
    TOKENS,
} from 'test/lib/utils';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';

async function runAgainstFork() {
    // User defined inputs
    const { rpcUrl } = await startFork(ANVIL_NETWORKS.SEPOLIA);
    const chainId = ChainId.SEPOLIA;
    const wrappedTokenAddress =
        '0x131a121bda71ed810bcaf2ac9079214925e59c18' as Address;
    const underlyingTokenAddress =
        '0x29f2d40b0605204364af54ec677bd022da425d03' as Address;
    const slippage = Slippage.fromPercentage('1'); // 1%

    const client = createTestClient({
        mode: 'anvil',
        chain: CHAINS[chainId],
        transport: http(rpcUrl),
    })
        .extend(publicActions)
        .extend(walletActions);

    const userAccount = (await client.getAddresses())[0];

    // setup fork token balances
    await setTokenBalances(
        client,
        userAccount,
        [wrappedTokenAddress, underlyingTokenAddress],
        [
            TOKENS[chainId].stataEthWBTC.slot as number,
            TOKENS[chainId].WBTC.slot as number,
        ],
        [parseUnits('1', 8), parseUnits('1', 8)],
    );

    // build add liquidity buffer transaction data
    const call = await addLiquidityExample({
        rpcUrl,
        chainId,
        wrappedTokenAddress,
        exactSharesToIssue: 100000n,
        slippage,
    });

    const tokensForBalanceCheck = [wrappedTokenAddress, underlyingTokenAddress];

    // approve permit2 to spend erc20 and erc4626 tokens
    await approveSpenderOnTokens(
        client,
        userAccount,
        tokensForBalanceCheck,
        PERMIT2[chainId],
    );

    // approve buffer router to spend erc20 and erc4626 tokens via permit2
    await approveSpenderOnPermit2(
        client,
        userAccount,
        wrappedTokenAddress,
        AddressProvider.BufferRouter(chainId),
    );
    await approveSpenderOnPermit2(
        client,
        userAccount,
        underlyingTokenAddress,
        AddressProvider.BufferRouter(chainId),
    );

    // send the transaction
    console.log('\nSending tx...');
    const { transactionReceipt, balanceDeltas } =
        await sendTransactionGetBalances(
            tokensForBalanceCheck,
            client,
            userAccount,
            call.to,
            call.callData,
        );

    // check results
    if (transactionReceipt.status === 'reverted')
        throw Error('Transaction reverted');
    console.log('Token balance deltas:');
    console.table({
        tokensForBalanceCheck,
        balanceDeltas,
    });
}

export const addLiquidityExample = async ({
    rpcUrl,
    chainId,
    wrappedTokenAddress,
    exactSharesToIssue,
    slippage,
}: {
    rpcUrl: string;
    chainId: ChainId;
    wrappedTokenAddress: Address;
    exactSharesToIssue: bigint;
    slippage: Slippage;
}) => {
    // API is used to fetch relevant pool data
    const frontierApi = new FrontierApi(TEST_API_ENDPOINT, chainId);
    const bufferState =
        await frontierApi.buffers.fetchBufferState(wrappedTokenAddress);

    // Construct the AddLiquidityBufferInput
    const addLiquidityBufferInput: AddLiquidityBufferInput = {
        chainId,
        rpcUrl,
        exactSharesToIssue,
    };

    // Simulate addLiquidity to get the amount of BPT out
    const addLiquidityBuffer = new AddLiquidityBufferV3();
    const queryOutput = await addLiquidityBuffer.query(
        addLiquidityBufferInput,
        bufferState,
    );

    console.log('\nAdd Liquidity Query Output:');
    console.log(`Wrapped In: ${queryOutput.wrappedAmountIn.amount.toString()}`);
    console.log(
        `Underlying In: ${queryOutput.underlyingAmountIn.amount.toString()}`,
    );
    console.log(
        `Exact Shares To Issue: ${queryOutput.exactSharesToIssue.toString()}`,
    );

    // Apply slippage to the BPT amount received from the query and construct the call
    const call = addLiquidityBuffer.buildCall({
        ...queryOutput,
        slippage,
    });

    console.log('\nWith slippage applied:');
    console.log(`Max Wrapped In: ${call.maxWrappedAmountIn.amount.toString()}`);
    console.log(
        `Max Underlying In: ${call.maxUnderlyingAmountIn.amount.toString()}`,
    );

    return call;
};

export default runAgainstFork;
