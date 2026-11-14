/**
 * Example showing how to calculate price impact when adding liquidity with unbalanced inputs.
 *
 * Run with:
 * pnpm example ./examples/priceImpact/addLiquidity.ts
 */
import { config } from 'dotenv';
config();

import { Address, parseEther, parseUnits } from 'viem';
import {
    AddLiquidityInput,
    AddLiquidityKind,
    FrontierApi,
    ChainId,
    PriceImpact,
    API_ENDPOINT,
} from 'src';
import { ANVIL_NETWORKS, startFork } from 'test/anvil/anvil-global-setup';

const addLiquidityPriceImpact = async () => {
    const { rpcUrl } = await startFork(ANVIL_NETWORKS.SEPOLIA);
    const chainId = ChainId.SEPOLIA;
    const poolId = '0xca9f6d682162cca9e0bf3c96de649e372099d89d';
    const amountsIn = [
        {
            rawAmount: parseUnits('10', 6),
            decimals: 6,
            address: '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8' as Address,
        },
        {
            rawAmount: parseEther('0.001'),
            decimals: 18,
            address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14' as Address,
        },
    ];

    const frontierApi = new FrontierApi(API_ENDPOINT, chainId);
    const poolState = await frontierApi.pools.fetchPoolState(poolId);

    const addLiquidityInput: AddLiquidityInput = {
        amountsIn,
        chainId,
        rpcUrl,
        kind: AddLiquidityKind.Unbalanced,
    };

    const priceImpact = await PriceImpact.addLiquidityUnbalanced(
        addLiquidityInput,
        poolState,
    );
    console.log('\nPool address: ', poolState.address);
    console.log('Amounts in: ', amountsIn);
    console.log(`Price Impact: ${priceImpact.percentage.toFixed(2)}%\n`);
};

export default addLiquidityPriceImpact;
