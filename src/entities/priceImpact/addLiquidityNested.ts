import { InputAmount } from '@/types';
import { AddLiquidity } from '../addLiquidity';
import {
    AddLiquidityBaseInput,
    AddLiquidityKind,
    AddLiquidityUnbalancedInput,
} from '../addLiquidity/types';
import { AddLiquidityBoostedV3 } from '../addLiquidityBoosted';
import { AddLiquidityBoostedUnbalancedInput } from '../addLiquidityBoosted/types';
import { AddLiquidityNestedInput } from '../addLiquidityNested/types';
import { PriceImpactAmount } from '../priceImpactAmount';
import { TokenAmount } from '../tokenAmount';
import {
    NestedPoolState,
    NestedPoolV2,
    NestedPoolV3,
    PoolState,
} from '../types';
import { isPoolToken } from '../utils/isPoolToken';
import { addLiquidityUnbalanced } from './addLiquidityUnbalanced';
import { addLiquidityUnbalancedBoosted } from './addLiquidityUnbalancedBoosted';

type AddResult = {
    priceImpactAmount: PriceImpactAmount;
    bptOut: TokenAmount;
};

export async function addLiquidityNested(
    input: AddLiquidityNestedInput,
    nestedPoolState: NestedPoolState,
): Promise<PriceImpactAmount> {
    const addLiquidity = new AddLiquidity();
    const addLiquidityBoosted = new AddLiquidityBoostedV3();
    const queryContext: AddLiquidityBaseInput = {
        chainId: input.chainId,
        rpcUrl: input.rpcUrl,
        sender: 'sender' in input ? input.sender : undefined,
        userData: 'userData' in input ? input.userData : undefined,
    };
    // sort pools from child to parent
    const sortedPools = nestedPoolState.pools.sort((a, b) => a.level - b.level);
    // Price impact amounts from all add actions
    const priceImpactAmounts: PriceImpactAmount[] = [];
    // BPT out from each child pool add action
    const childrenBptOuts: InputAmount[] = [];

    // For each pool (including parent), find PI from the corresponding add operation
    for (const pool of sortedPools) {
        let amountsIn: InputAmount[] = [];
        let isBoostedPool = false;
        if (pool.level === 0) {
            // A lower level pool
            // Find any user input amount related to the current pool & check if pool is boosted
            amountsIn = input.amountsIn.filter((a) => {
                const poolToken = isPoolToken(pool.tokens, a.address);
                if (poolToken.isPoolToken && poolToken.isUnderlyingToken)
                    isBoostedPool = true;
                return poolToken.isPoolToken;
            });
            // skip pool if no relevant amountsIn
            if (amountsIn.length === 0) continue;
        } else {
            // The parent pool
            // Find any user input amount or bpt from child adds related to the current pool & check if pool is boosted
            amountsIn = [...childrenBptOuts, ...input.amountsIn].filter((a) => {
                const poolToken = isPoolToken(pool.tokens, a.address);
                if (poolToken.isPoolToken && poolToken.isUnderlyingToken)
                    isBoostedPool = true;
                return poolToken.isPoolToken;
            });
        }
        let addResult: AddResult;
        if (isBoostedPool)
            addResult = await getAddBoostedUnbalancedResult(
                addLiquidityBoosted,
                queryContext,
                pool as NestedPoolV3,
                amountsIn,
            );
        else
            addResult = await getAddUnbalancedResult(
                addLiquidity,
                queryContext,
                pool as NestedPoolV2,
                amountsIn,
                nestedPoolState.protocolVersion,
            );

        priceImpactAmounts.push(addResult.priceImpactAmount);
        childrenBptOuts.push(addResult.bptOut.toInputAmount());
    }

    const priceImpactSum = priceImpactAmounts.reduce(
        (acc, cur) => acc + cur.amount,
        0n,
    );

    return PriceImpactAmount.fromRawAmount(priceImpactSum);
}

async function getAddUnbalancedResult(
    addLiquidity: AddLiquidity,
    queryContext: AddLiquidityBaseInput,
    pool: NestedPoolV2,
    amountsIn: InputAmount[],
    protocolVersion: 1 | 2 | 3,
): Promise<AddResult> {
    const addLiquidityInput: AddLiquidityUnbalancedInput = {
        ...queryContext,
        amountsIn,
        kind: AddLiquidityKind.Unbalanced,
    };
    const poolState: PoolState = {
        ...pool,
        protocolVersion,
    };
    const priceImpactAmount = await addLiquidityUnbalanced(
        addLiquidityInput,
        poolState,
    );

    const { bptOut } = await addLiquidity.query(addLiquidityInput, poolState);

    return { priceImpactAmount, bptOut };
}

async function getAddBoostedUnbalancedResult(
    addLiquidityBoosted: AddLiquidityBoostedV3,
    queryContext: AddLiquidityBaseInput,
    pool: NestedPoolV3,
    amountsIn: InputAmount[],
): Promise<AddResult> {
    const addLiquidityInput: AddLiquidityBoostedUnbalancedInput = {
        ...queryContext,
        amountsIn,
        kind: AddLiquidityKind.Unbalanced,
    };

    const priceImpactAmount = await addLiquidityUnbalancedBoosted(
        addLiquidityInput,
        { ...pool, protocolVersion: 3 },
    );

    const { bptOut } = await addLiquidityBoosted.query(addLiquidityInput, {
        ...pool,
        protocolVersion: 3,
    });

    return { priceImpactAmount, bptOut };
}
