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
    const poolId = '0x59fa488dda749cdd41772bb068bb23ee955a6d7a';

    const amountsIn = [
        {
            rawAmount: parseUnits('1', 6),
            decimals: 6,
            address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8' as Address,
        },
        {
            rawAmount: parseUnits('1', 6),
            decimals: 6,
            address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0' as Address,
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
