/**
 * Example showing how to remove liquidity from a V3 pool.
 * (Runs against a local Anvil fork)
 *
 * Run with:
 * pnpm example ./examples/removeLiquidity/removeLiquidity.ts
 */
import {
    Address,
    createTestClient,
    http,
    parseEther,
    parseUnits,
    publicActions,
    walletActions,
} from 'viem';
import {
    FrontierApi,
    API_ENDPOINT,
    CHAINS,
    ChainId,
    InputAmount,
    PoolState,
    PriceImpact,
    RemoveLiquidity,
    RemoveLiquidityInput,
    RemoveLiquidityKind,
    Slippage,
} from '../../src';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';
import { addLiquidityExample } from 'examples/addLiquidity/addLiquidityUnbalanced';
import { getSlot } from 'examples/lib/getSlot';
import { approveSpenderOnToken } from 'test/lib/utils';
import { ANVIL_NETWORKS, startFork } from '../../test/anvil/anvil-global-setup';
import { makeForkTx } from '../lib/makeForkTx';

async function runAgainstFork() {
    const { rpcUrl } = await startFork(ANVIL_NETWORKS.SEPOLIA);
    const chainId = ChainId.SEPOLIA;
    const client = createTestClient({
        mode: 'anvil',
        chain: CHAINS[chainId],
        transport: http(rpcUrl),
    })
        .extend(publicActions)
        .extend(walletActions);
    const userAccount = (await client.getAddresses())[0];
    const pool = {
        id: '0xca9f6d682162cca9e0bf3c96de649e372099d89d',
        address: '0xca9f6d682162cca9e0bf3c96de649e372099d89d' as Address,
    };
    const slippage = Slippage.fromPercentage('1'); // 1%

    // Add liquidity first so userAccount holds V3 BPT in the Vault
    const amountsIn = [
        {
            rawAmount: parseUnits('1', 6),
            decimals: 6,
            address: '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8' as Address,
        },
        {
            rawAmount: parseEther('0.001'),
            decimals: 18,
            address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14' as Address,
        },
    ];
    const addLiquidityCall = await addLiquidityExample({
        rpcUrl,
        chainId,
        amountsIn,
        poolId: pool.id,
        slippage,
    });
    await makeForkTx(
        addLiquidityCall,
        {
            rpcUrl,
            chainId,
            impersonateAccount: userAccount,
            forkTokens: amountsIn.map((a) => ({
                address: a.address,
                slot: getSlot(chainId, a.address),
                rawBalance: a.rawAmount,
            })),
            client,
        },
        [...amountsIn.map((a) => a.address), pool.address],
        addLiquidityCall.protocolVersion,
    );

    // Approve Router to burn BPT for removeLiquidity
    await approveSpenderOnToken(
        client,
        userAccount,
        pool.address,
        AddressProvider.Router(chainId),
    );

    const bptIn: InputAmount = {
        rawAmount: parseEther('0.001'),
        decimals: 18,
        address: pool.address,
    };
    const tokenOut = '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8' as Address;

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
            forkTokens: [],
            client,
        },
        [
            '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8' as Address,
            '0xfff9976782d46cc05630d1f6ebab18b2324d6b14' as Address,
            pool.address,
        ],
        call.protocolVersion,
        false,
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
