/**
 * Example showing how to add liquidity proportionally to a V3 pool.
 * (Runs against a local Anvil fork)
 *
 * Run with:
 * pnpm example ./examples/addLiquidity/addLiquidityProportional.ts
 */
import { Address, parseEther } from 'viem';
import {
    AddLiquidityInput,
    AddLiquidityKind,
    AddLiquidity,
    FrontierApi,
    API_ENDPOINT,
    ChainId,
    Slippage,
} from '../../src';
import { ANVIL_NETWORKS, startFork } from '../../test/anvil/anvil-global-setup';
import { makeForkTx } from '../lib/makeForkTx';
import { getSlot } from 'examples/lib/getSlot';

async function runAgainstFork() {
    // User defined inputs
    const { rpcUrl } = await startFork(ANVIL_NETWORKS.SEPOLIA);
    const chainId = ChainId.SEPOLIA;
    const userAccount = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const pool = {
        id: '0x2ff3b96e0057a1f25f1d62ab800554ccdb268ab8',
        address: '0x2ff3b96e0057a1f25f1d62ab800554ccdb268ab8' as Address,
    };

    const referenceAmount = {
        rawAmount: parseEther('0.0001'),
        decimals: 18,
        address: '0x7b79995e5f793a07bc00c21412e50ecae098e7f9' as Address,
    };

    const slippage = Slippage.fromPercentage('1'); // 1%

    const call = await addLiquidityProportional({
        rpcUrl,
        chainId,
        referenceAmount,
        poolId: pool.id,
        slippage,
    });

    await makeForkTx(
        call,
        {
            rpcUrl,
            chainId,
            impersonateAccount: userAccount,
            forkTokens: call.maxAmountsIn.map((a) => ({
                address: a.token.address,
                slot: getSlot(chainId, a.token.address),
                rawBalance: a.amount,
            })),
        },
        [...call.maxAmountsIn.map((a) => a.token.address), pool.address],
        call.protocolVersion,
    );
}

const addLiquidityProportional = async ({
    rpcUrl,
    chainId,
    poolId,
    referenceAmount,
    slippage,
}) => {
    const frontierApi = new FrontierApi(API_ENDPOINT, chainId);
    const poolState = await frontierApi.pools.fetchPoolState(poolId);

    const addLiquidityInput: AddLiquidityInput = {
        referenceAmount,
        chainId,
        rpcUrl,
        kind: AddLiquidityKind.Proportional,
    };

    const addLiquidity = new AddLiquidity();
    const queryOutput = await addLiquidity.query(addLiquidityInput, poolState);

    console.log('\nAdd Liquidity Query Output:');
    console.log('Tokens In:');
    queryOutput.amountsIn.map((a) =>
        console.log(a.token.address, a.amount.toString()),
    );
    console.log(`BPT Out: ${queryOutput.bptOut.amount.toString()}`);

    const call = addLiquidity.buildCall({
        ...queryOutput,
        slippage,
        chainId,
        wethIsEth: false,
        userData: '0x',
    });

    console.log('\nWith slippage applied:');
    console.log('Max tokens in:');
    call.maxAmountsIn.forEach((a) =>
        console.log(a.token.address, a.amount.toString()),
    );
    console.log(`Min BPT Out: ${call.minBptOut.amount.toString()}`);

    return {
        ...call,
        protocolVersion: queryOutput.protocolVersion,
    };
};

export default runAgainstFork;
