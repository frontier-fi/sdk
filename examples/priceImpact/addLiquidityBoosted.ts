/**
 * Example showing how to calculate price impact when adding liquidity with unbalanced inputs to a boosted pool.
 *
 * Run with:
 * pnpm example ./examples/priceImpact/addLiquidityBoosted.ts
 */
import { config } from 'dotenv';
config();

import { Address, parseUnits } from 'viem';
import {
    AddLiquidityKind,
    FrontierApi,
    ChainId,
    PriceImpact,
    API_ENDPOINT,
    AddLiquidityBoostedUnbalancedInput,
} from 'src';
import { ANVIL_NETWORKS, startFork } from 'test/anvil/anvil-global-setup';

const addLiquidityPriceImpact = async () => {
    const { rpcUrl } = await startFork(ANVIL_NETWORKS.SEPOLIA);
    const chainId = ChainId.SEPOLIA;
    const poolId = '0x8e06ef1a2e854feaee0a83510acd05f8e443fa4f';

    const amountsIn = [
        {
            rawAmount: parseUnits('0.001', 8),
            decimals: 8,
            address: '0x29f2d40b0605204364af54ec677bd022da425d03' as Address,
        },
        {
            rawAmount: parseUnits('0.2', 18),
            decimals: 18,
            address: '0x88541670e55cc00beefd87eb59edd1b7c511ac9a' as Address,
        },
    ];

    const frontierApi = new FrontierApi(API_ENDPOINT, chainId);
    const poolStateWithUnderlyings =
        await frontierApi.boostedPools.fetchPoolStateWithUnderlyings(poolId);

    const addLiquidityInput: AddLiquidityBoostedUnbalancedInput = {
        amountsIn,
        chainId,
        rpcUrl,
        kind: AddLiquidityKind.Unbalanced,
    };

    const priceImpact = await PriceImpact.addLiquidityUnbalancedBoosted(
        addLiquidityInput,
        poolStateWithUnderlyings,
    );
    console.log('\nPool address: ', poolStateWithUnderlyings.address);
    console.log('Amounts in: ', amountsIn);
    console.log(`Price Impact: ${priceImpact.percentage.toFixed(2)}%\n`);
};

export default addLiquidityPriceImpact;
