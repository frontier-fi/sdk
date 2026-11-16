import { AddLiquidityAmounts } from '../types';
import { AddLiquidityBaseBuildCallInput, AddLiquidityKind } from './types';

export const getAmountsCall = (
    input: AddLiquidityBaseBuildCallInput,
): AddLiquidityAmounts => {
    switch (input.addLiquidityKind) {
        case AddLiquidityKind.Unbalanced: {
            const minimumBpt = input.slippage.applyTo(input.bptOut.amount, -1);
            const maxAmountsIn = input.amountsIn.map((a) => a.amount);
            return {
                minimumBpt,
                maxAmountsIn,
                tokenInIndex: input.tokenInIndex,
            };
        }
        case AddLiquidityKind.SingleToken:
        case AddLiquidityKind.Proportional: {
            const maxAmountsIn = input.amountsIn.map((a) =>
                input.slippage.applyTo(a.amount),
            );
            return {
                minimumBpt: input.bptOut.amount,
                maxAmountsIn,
                tokenInIndex: input.tokenInIndex,
            };
        }
    }
};
