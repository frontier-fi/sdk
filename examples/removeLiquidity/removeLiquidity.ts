/**
 * Example showing how to remove liquidity from a V3 pool.
 * (Runs against a local Anvil fork)
 *
 * Run with:
 * pnpm example ./examples/removeLiquidity/removeLiquidity.ts
 */
import { Address, parseEther } from 'viem';
import {
    FrontierApi,
    API_ENDPOINT,
    ChainId,
    InputAmount,
    PoolState,
    PriceImpact,
    RemoveLiquidity,
    RemoveLiquidityInput,
    RemoveLiquidityKind,
    Slippage,
} from '../../src';
import { ANVIL_NETWORKS, startFork } from '../../test/anvil/anvil-global-setup';
import { makeForkTx } from '../lib/makeForkTx';

async function runAgainstFork() {
    const { rpcUrl } = await startFork(ANVIL_NETWORKS.SEPOLIA);
    const chainId = ChainId.SEPOLIA;
    const userAccount = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const pool = {
        id: '0xb790fa0ba5d563b814b0ca1716c414f6b99937b2',
        address: '0xb790fa0ba5d563b814b0ca1716c414f6b99937b2' as Address,
    };
    const bptIn: InputAmount = {
        rawAmount: parseEther('0.001'),
        decimals: 18,
        address: pool.address,
    };
    const tokenOut = '0xb19382073c7A0aDdbb56Ac6AF1808Fa49e377B75' as Address;
    const slippage = Slippage.fromPercentage('1'); // 1%

    const call = await removeLiquidity({
        rpcUrl,
        chainId,
        bptIn,
        tokenOut,
        poolId: pool.id,
        slippage,
    });

    await makeForkTx(
        call,
        {
            rpcUrl,
            chainId,
            impersonateAccount: userAccount,
            forkTokens: [
                {
                    address: pool.address,
                    slot: 0,
                    rawBalance: parseEther('1'),
                },
            ],
        },
        [
            '0xb19382073c7A0aDdbb56Ac6AF1808Fa49e377B75' as Address,
            '0x7b79995e5f793a07bc00c21412e50ecae098e7f9' as Address,
            pool.address,
        ],
        call.protocolVersion,
    );
}

const removeLiquidity = async ({
    rpcUrl,
    chainId,
    poolId,
    bptIn,
    tokenOut,
    slippage,
}) => {
    const frontierApi = new FrontierApi(API_ENDPOINT, chainId);
    const poolState: PoolState = await frontierApi.pools.fetchPoolState(poolId);

    const removeLiquidityInput: RemoveLiquidityInput = {
        chainId,
        rpcUrl,
        bptIn,
        tokenOut,
        kind: RemoveLiquidityKind.SingleTokenExactIn,
    };

    const priceImpact = await PriceImpact.removeLiquidity(
        removeLiquidityInput,
        poolState,
    );
    console.log(`\nPrice Impact: ${priceImpact.percentage.toFixed(2)}%`);

    const removeLiquidity = new RemoveLiquidity();
    const queryOutput = await removeLiquidity.query(
        removeLiquidityInput,
        poolState,
    );

    console.log('\nRemove Liquidity Query Output:');
    console.log(`BPT In: ${queryOutput.bptIn.amount.toString()}`);
    console.table({
        tokensOut: queryOutput.amountsOut.map((a) => a.token.address),
        amountsOut: queryOutput.amountsOut.map((a) => a.amount),
    });

    const call = removeLiquidity.buildCall({
        ...queryOutput,
        slippage,
        chainId,
        userData: '0x',
    });

    console.log('\nWith slippage applied:');
    console.log(`Max BPT In: ${call.maxBptIn.amount}`);
    console.table({
        tokensOut: call.minAmountsOut.map((a) => a.token.address),
        minAmountsOut: call.minAmountsOut.map((a) => a.amount),
    });

    return {
        ...call,
        protocolVersion: queryOutput.protocolVersion,
    };
};

export default runAgainstFork;
