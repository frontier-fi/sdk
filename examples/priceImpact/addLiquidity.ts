/**
 * Example showing how to calculate price impact when adding liquidity with unbalanced inputs.
 *
 * Run with:
 * pnpm example ./examples/priceImpact/addLiquidity.ts
 */
import { config } from 'dotenv';
config();

import { Address, parseEther } from 'viem';
import {
    AddLiquidityInput,
    AddLiquidityKind,
    FrontierApi,
    ChainId,
    PriceImpact,
    API_ENDPOINT,
} from 'src';

const addLiquidityPriceImpact = async () => {
    const rpcUrl = process.env.SEPOLIA_RPC_URL as string;
    const chainId = ChainId.SEPOLIA;
    const poolId = '0xb790fa0ba5d563b814b0ca1716c414f6b99937b2';
    const amountsIn = [
        {
            rawAmount: parseEther('0.01'),
            decimals: 18,
            address: '0xb19382073c7A0aDdbb56Ac6AF1808Fa49e377B75' as Address,
        },
        {
            rawAmount: parseEther('0.01'),
            decimals: 18,
            address: '0x7b79995e5f793a07bc00c21412e50ecae098e7f9' as Address,
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
