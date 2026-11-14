import { Address, PoolState, ZERO_ADDRESS } from '../../../src';

/**
 * Get tokens from the pool formatted for balance check, i.e. [...poolTokens, bpt, eth]
 * @param poolState PoolState
 * @returns Address[]
 */
export function getTokensForBalanceCheck(poolState: PoolState): Address[] {
    // pool tokens, bpt, eth
    return [
        ...poolState.tokens.map((t) => t.address),
        poolState.address,
        ZERO_ADDRESS,
    ];
}
