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
    const poolId = '0xca9f6d682162cca9e0bf3c96de649e372099d89d';
    const pool =
        await poolDataProvider.pools.fetchPoolStateWithBalances(poolId);
    const inputAmount: InputAmount = {
        rawAmount: 100000000000000n,
        address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
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
