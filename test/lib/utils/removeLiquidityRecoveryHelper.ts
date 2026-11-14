import {
    ChainId,
    NATIVE_ASSETS,
    PoolState,
    RemoveLiquidityBuildCallOutput,
    RemoveLiquidityQueryOutput,
    RemoveLiquidityRecoveryInput,
    RemoveLiquidityV3BuildCallInput,
    Slippage,
    Token,
    TokenAmount,
} from 'src';
import { getTokensForBalanceCheck } from './getTokensForBalanceCheck';
import { sendTransactionGetBalances } from './helper';
import { RemoveLiquidityRecoveryTxInput } from './types';
import {
    RemoveLiquidityOutput,
    assertRemoveLiquidityBuildCallOutput,
    assertTokenDeltas,
    getCheck,
} from './removeLiquidityHelper';
import { Hex } from 'viem';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';

export const sdkRemoveLiquidityRecovery = async ({
    removeLiquidity,
    removeLiquidityRecoveryInput,
    poolState,
    slippage,
    wethIsEth,
}: Omit<RemoveLiquidityRecoveryTxInput, 'client'>): Promise<{
    removeLiquidityBuildCallOutput: RemoveLiquidityBuildCallOutput;
    removeLiquidityQueryOutput: RemoveLiquidityQueryOutput;
}> => {
    const removeLiquidityQueryOutput = await removeLiquidity.query(
        removeLiquidityRecoveryInput,
        poolState,
    );

    const removeLiquidityBuildInput: RemoveLiquidityV3BuildCallInput = {
        ...removeLiquidityQueryOutput,
        slippage,
        wethIsEth: !!wethIsEth,
        userData: removeLiquidityRecoveryInput.userData ?? '0x',
    };

    const removeLiquidityBuildCallOutput = removeLiquidity.buildCall(
        removeLiquidityBuildInput,
    );

    return {
        removeLiquidityBuildCallOutput,
        removeLiquidityQueryOutput,
    };
};

export async function doRemoveLiquidityRecovery(
    txInput: RemoveLiquidityRecoveryTxInput,
) {
    const {
        removeLiquidity,
        poolState,
        removeLiquidityRecoveryInput,
        testAddress,
        client,
        slippage,
        wethIsEth,
    } = txInput;

    const { removeLiquidityQueryOutput, removeLiquidityBuildCallOutput } =
        await sdkRemoveLiquidityRecovery({
            removeLiquidity,
            removeLiquidityRecoveryInput,
            poolState,
            slippage,
            testAddress,
            wethIsEth,
        });

    const tokens = getTokensForBalanceCheck(poolState);

    const txOutput = await sendTransactionGetBalances(
        tokens,
        client,
        testAddress,
        removeLiquidityBuildCallOutput.to,
        removeLiquidityBuildCallOutput.callData,
        removeLiquidityBuildCallOutput.value,
    );

    return {
        removeLiquidityQueryOutput,
        removeLiquidityBuildCallOutput,
        txOutput,
    };
}

export function assertRemoveLiquidityRecovery(
    poolState: PoolState,
    removeLiquidityRecoveryInput: RemoveLiquidityRecoveryInput,
    removeLiquidityOutput: RemoveLiquidityOutput,
    slippage: Slippage,
    chainId: ChainId,
    protocolVersion: 3 = 3,
    wethIsEth?: boolean,
) {
    const {
        txOutput,
        removeLiquidityQueryOutput,
        removeLiquidityBuildCallOutput,
    } = removeLiquidityOutput;

    const bptToken = new Token(
        removeLiquidityRecoveryInput.chainId,
        poolState.address,
        18,
    );

    const expectedQueryOutput: Omit<
        RemoveLiquidityQueryOutput,
        'amountsOut'
    > & {
        userData: Hex;
    } = {
        bptIn: TokenAmount.fromRawAmount(
            bptToken,
            removeLiquidityRecoveryInput.bptIn.rawAmount,
        ),
        tokenOutIndex: undefined,
        poolId: poolState.id,
        poolType: poolState.type,
        removeLiquidityKind: removeLiquidityRecoveryInput.kind,
        protocolVersion: poolState.protocolVersion,
        chainId: removeLiquidityRecoveryInput.chainId,
        to: AddressProvider.Router(chainId),
        userData: '0x',
    };

    const queryCheck = getCheck(removeLiquidityQueryOutput, true);

    expect(queryCheck).to.deep.eq(expectedQueryOutput);

    removeLiquidityQueryOutput.amountsOut.forEach((a) => {
        if (a.token.address === poolState.address) expect(a.amount).toEqual(0n);
        else expect(a.amount > 0n).to.be.true;
    });

    if (wethIsEth) {
        expect(
            removeLiquidityQueryOutput.amountsOut.some((a) =>
                a.token.isSameAddress(
                    NATIVE_ASSETS[removeLiquidityQueryOutput.chainId].wrapped,
                ),
            ),
        ).to.be.true;
    }

    assertRemoveLiquidityBuildCallOutput(
        removeLiquidityQueryOutput,
        removeLiquidityBuildCallOutput,
        true,
        slippage,
        protocolVersion,
    );

    assertTokenDeltas(
        poolState,
        removeLiquidityRecoveryInput,
        removeLiquidityQueryOutput,
        txOutput,
        wethIsEth,
    );
}
