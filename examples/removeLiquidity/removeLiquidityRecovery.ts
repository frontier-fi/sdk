/**
 * Example showing how to remove liquidity from a pool in recovery mode.
 * (Runs against a local Anvil fork)
 *
 * Run with:
 * pnpm example ./examples/removeLiquidity/removeLiquidityRecovery.ts
 */
import {
    Address,
    createTestClient,
    http,
    parseAbi,
    parseEther,
    parseUnits,
    publicActions,
    TestActions,
    toFunctionSelector,
    walletActions,
} from 'viem';
import {
    FrontierApi,
    API_ENDPOINT,
    CHAINS,
    ChainId,
    InputAmount,
    PoolState,
    PublicWalletClient,
    RemoveLiquidity,
    RemoveLiquidityKind,
    RemoveLiquidityRecoveryInput,
    Slippage,
    vaultAdminAbi_V3,
} from '../../src';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';
import { addLiquidityExample } from 'examples/addLiquidity/addLiquidityUnbalanced';
import { getSlot } from 'examples/lib/getSlot';
import { approveSpenderOnToken } from 'test/lib/utils';
import { ANVIL_NETWORKS, startFork } from '../../test/anvil/anvil-global-setup';
import { makeForkTx } from '../lib/makeForkTx';

const AUTHORIZER_SEPOLIA: Address =
    '0xEdFdDa22252399BDDAeE8d6D8e93c32cA3c31eeE';
const ADMIN_OF_AUTHORIZER: Address =
    '0xAD2906fAf5eFEC651f54372b121414FF0EeC6B1D';
const authorizerAbi = parseAbi([
    'function grantRole(bytes32 role, address account)',
]);

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

    await enablePoolRecoveryMode(client, chainId, pool.address, userAccount);

    // Approve Router to burn BPT for removeLiquidityRecovery
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

    const call = await removeLiquidity({
        rpcUrl,
        chainId,
        bptIn,
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

async function enablePoolRecoveryMode(
    client: PublicWalletClient & TestActions,
    chainId: ChainId,
    poolAddress: Address,
    authorizedAddress: Address,
) {
    const actionId = await client.readContract({
        address: AddressProvider.VaultAdmin(chainId),
        abi: vaultAdminAbi_V3,
        functionName: 'getActionId',
        args: [toFunctionSelector('function enableRecoveryMode(address)')],
    });
    await client.setBalance({
        address: ADMIN_OF_AUTHORIZER,
        value: parseEther('1'),
    });
    await client.impersonateAccount({ address: ADMIN_OF_AUTHORIZER });
    const grantHash = await client.writeContract({
        address: AUTHORIZER_SEPOLIA,
        abi: authorizerAbi,
        chain: CHAINS[chainId],
        functionName: 'grantRole',
        args: [actionId, authorizedAddress],
        account: ADMIN_OF_AUTHORIZER,
    });
    await client.waitForTransactionReceipt({ hash: grantHash });
    await client.stopImpersonatingAccount({ address: ADMIN_OF_AUTHORIZER });

    const enableHash = await client.writeContract({
        address: AddressProvider.Vault(chainId),
        abi: vaultAdminAbi_V3,
        chain: CHAINS[chainId],
        functionName: 'enableRecoveryMode',
        args: [poolAddress],
        account: authorizedAddress,
    });
    await client.waitForTransactionReceipt({ hash: enableHash });
}

const removeLiquidity = async ({
    rpcUrl,
    chainId,
    poolId,
    bptIn,
    slippage,
}) => {
    const frontierApi = new FrontierApi(API_ENDPOINT, chainId);
    const poolState: PoolState = await frontierApi.pools.fetchPoolState(poolId);

    const removeLiquidityRecoveryInput: RemoveLiquidityRecoveryInput = {
        chainId,
        rpcUrl,
        bptIn,
        kind: RemoveLiquidityKind.Recovery,
    };

    const removeLiquidity = new RemoveLiquidity();
    const queryOutput = await removeLiquidity.query(
        removeLiquidityRecoveryInput,
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
