/**
 * Example showing how to use calculateProportionalAmounts helper to calculate proportional input amounts.
 *
 * Run with:
 * pnpm example ./examples/utils/calculateProportionalAmounts.ts
 */
import {
    FrontierApi,
    API_ENDPOINT,
    calculateProportionalAmounts,
    InputAmount,
    ChainId,
} from '../../src';

const calculateProportionalAmountsExample = async () => {
    const chainId = ChainId.SEPOLIA;
    const poolDataProvider = new FrontierApi(API_ENDPOINT, chainId);
    const poolId = '0xb790fa0ba5d563b814b0ca1716c414f6b99937b2';
    const pool =
        await poolDataProvider.pools.fetchPoolStateWithBalances(poolId);
    const inputAmount: InputAmount = {
        rawAmount: 10000000000000000n,
        address: '0x7b79995e5f793a07bc00c21412e50ecae098e7f9',
        decimals: 18,
    };
    const { tokenAmounts, bptAmount } = calculateProportionalAmounts(
        pool,
        inputAmount,
    );
    console.log(
        `Token Addresses:     ${tokenAmounts.map(({ address }) => address)}`,
    );
    console.log(
        `Proportional Amounts:${tokenAmounts.map(
            ({ rawAmount }) => rawAmount,
        )}`,
    );
    console.log(`BPT Out:             ${bptAmount.rawAmount}`);
};

export default calculateProportionalAmountsExample;
