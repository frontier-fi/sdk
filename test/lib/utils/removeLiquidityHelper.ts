import { Hex } from 'viem';
import {
    ChainId,
    missingParameterError,
    NATIVE_ASSETS,
    PermitHelper,
    PoolState,
    RemoveLiquidityBuildCallOutput,
    RemoveLiquidityInput,
    RemoveLiquidityProportionalInput,
    RemoveLiquidityQueryOutput,
    RemoveLiquidityRecoveryInput,
    RemoveLiquiditySingleTokenExactInInput,
    RemoveLiquiditySingleTokenExactOutInput,
    RemoveLiquidityV3BuildCallInput,
    Slippage,
    Token,
    TokenAmount,
} from 'src';
import { getTokensForBalanceCheck } from './getTokensForBalanceCheck';
import { sendTransactionGetBalances, TxOutput } from './helper';
import { RemoveLiquidityTxInput } from './types';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';

export type RemoveLiquidityOutput = {
    removeLiquidityQueryOutput: RemoveLiquidityQueryOutput;
    removeLiquidityBuildCallOutput: RemoveLiquidityBuildCallOutput;
    txOutput: TxOutput;
};

export const sdkRemoveLiquidity = async ({
    removeLiquidity,
    removeLiquidityInput,
    poolState,
    slippage,
    testAddress,
    wethIsEth,
    client,
    usePermitSignatures,
}: RemoveLiquidityTxInput): Promise<{
    removeLiquidityBuildCallOutput: RemoveLiquidityBuildCallOutput;
    removeLiquidityQueryOutput: RemoveLiquidityQueryOutput;
}> => {
    const removeLiquidityQueryOutput = await removeLiquidity.query(
        removeLiquidityInput,
        poolState,
    );

    const removeLiquidityBuildInput: RemoveLiquidityV3BuildCallInput = {
        ...removeLiquidityQueryOutput,
        slippage,
        wethIsEth: !!wethIsEth,
        userData: removeLiquidityInput.userData ?? '0x',
    };

    let removeLiquidityBuildCallOutput: RemoveLiquidityBuildCallOutput;
    if (usePermitSignatures) {
        const permit = await PermitHelper.signRemoveLiquidityApproval({
            ...removeLiquidityBuildInput,
            client,
            owner: testAddress,
        });

        removeLiquidityBuildCallOutput = removeLiquidity.buildCallWithPermit(
            removeLiquidityBuildInput,
            permit,
        );
    } else {
        removeLiquidityBuildCallOutput = removeLiquidity.buildCall(
            removeLiquidityBuildInput,
        );
    }

    return {
        removeLiquidityBuildCallOutput,
        removeLiquidityQueryOutput,
    };
};

export function getCheck(
    output: RemoveLiquidityQueryOutput,
    isExactIn: boolean,
) {
    if (isExactIn) {
        const { amountsOut, ...check } = output;
        return check;
    }
    const { bptIn, ...check } = output;
    return check;
}

export async function doRemoveLiquidity(txInput: RemoveLiquidityTxInput) {
    const {
        removeLiquidity,
        poolState,
        removeLiquidityInput,
        testAddress,
        client,
        slippage,
        wethIsEth,
        usePermitSignatures,
    } = txInput;

    const { removeLiquidityQueryOutput, removeLiquidityBuildCallOutput } =
        await sdkRemoveLiquidity({
            removeLiquidity,
            removeLiquidityInput,
            poolState,
            slippage,
            testAddress,
            wethIsEth,
            client,
            usePermitSignatures,
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

export function assertRemoveLiquiditySingleTokenExactOut(
    poolState: PoolState,
    removeLiquidityInput: RemoveLiquiditySingleTokenExactOutInput,
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

    const expectedAmountsOut = poolState.tokens.map((t) => {
        const token = new Token(
            removeLiquidityInput.chainId,
            t.address,
            t.decimals,
        );
        const input = removeLiquidityInput.amountOut;
        if (input.address !== t.address) {
            return TokenAmount.fromRawAmount(token, 0n);
        }
        return TokenAmount.fromRawAmount(token, input.rawAmount);
    });

    const tokensWithoutBpt = poolState.tokens.filter(
        (t) => t.address !== poolState.address,
    );

    const expectedQueryOutput: Omit<RemoveLiquidityQueryOutput, 'bptIn'> & {
        userData: Hex;
    } = {
        to: AddressProvider.Router(chainId),
        amountsOut: expectedAmountsOut,
        tokenOutIndex: tokensWithoutBpt.findIndex(
            (t) => t.address === removeLiquidityInput.amountOut.address,
        ),
        poolId: poolState.id,
        poolType: poolState.type,
        removeLiquidityKind: removeLiquidityInput.kind,
        protocolVersion: poolState.protocolVersion,
        chainId: removeLiquidityInput.chainId,
        userData: '0x',
    };

    const queryCheck = getCheck(removeLiquidityQueryOutput, false);

    expect(queryCheck).to.deep.eq(expectedQueryOutput);
    expect(removeLiquidityQueryOutput.bptIn.amount > 0n).to.be.true;

    assertRemoveLiquidityBuildCallOutput(
        removeLiquidityQueryOutput,
        removeLiquidityBuildCallOutput,
        false,
        slippage,
        protocolVersion,
    );

    assertTokenDeltas(
        poolState,
        removeLiquidityInput,
        removeLiquidityQueryOutput,
        txOutput,
        wethIsEth,
    );
}

export function assertRemoveLiquiditySingleTokenExactIn(
    poolState: PoolState,
    removeLiquidityInput: RemoveLiquiditySingleTokenExactInInput,
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

    if (removeLiquidityQueryOutput.tokenOutIndex === undefined)
        throw missingParameterError(
            'Remove Liquidity SingleTokenExactIn',
            'tokenOutIndex',
            protocolVersion,
        );

    const bptToken = new Token(
        removeLiquidityInput.chainId,
        poolState.address,
        18,
    );

    const tokensWithoutBpt = poolState.tokens.filter(
        (t) => t.address !== poolState.address,
    );

    const expectedQueryOutput: Omit<
        RemoveLiquidityQueryOutput,
        'amountsOut'
    > & {
        userData: Hex;
    } = {
        to: AddressProvider.Router(chainId),
        bptIn: TokenAmount.fromRawAmount(
            bptToken,
            removeLiquidityInput.bptIn.rawAmount,
        ),
        tokenOutIndex: tokensWithoutBpt.findIndex(
            (t) => t.address === removeLiquidityInput.tokenOut,
        ),
        poolId: poolState.id,
        poolType: poolState.type,
        removeLiquidityKind: removeLiquidityInput.kind,
        protocolVersion: poolState.protocolVersion,
        chainId: removeLiquidityInput.chainId,
        userData: '0x',
    };

    const queryCheck = getCheck(removeLiquidityQueryOutput, true);

    expect(queryCheck).to.deep.eq(expectedQueryOutput);

    removeLiquidityQueryOutput.amountsOut.forEach((a) => {
        if (a.token.address === removeLiquidityInput.tokenOut) {
            expect(a.amount > 0n).to.be.true;
        } else {
            expect(a.amount).toEqual(0n);
        }
    });

    assertRemoveLiquidityBuildCallOutput(
        removeLiquidityQueryOutput,
        removeLiquidityBuildCallOutput,
        true,
        slippage,
        protocolVersion,
    );

    assertTokenDeltas(
        poolState,
        removeLiquidityInput,
        removeLiquidityQueryOutput,
        txOutput,
        wethIsEth,
    );
}

export function assertRemoveLiquidityProportional(
    poolState: PoolState,
    removeLiquidityInput: RemoveLiquidityProportionalInput,
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
        removeLiquidityInput.chainId,
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
            removeLiquidityInput.bptIn.rawAmount,
        ),
        tokenOutIndex: undefined,
        poolId: poolState.id,
        poolType: poolState.type,
        removeLiquidityKind: removeLiquidityInput.kind,
        protocolVersion: poolState.protocolVersion,
        chainId: removeLiquidityInput.chainId,
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
        removeLiquidityInput,
        removeLiquidityQueryOutput,
        txOutput,
        wethIsEth,
    );
}

export function assertTokenDeltas(
    poolState: PoolState,
    removeLiquidityInput: RemoveLiquidityInput | RemoveLiquidityRecoveryInput,
    removeLiquidityQueryOutput: RemoveLiquidityQueryOutput,
    txOutput: TxOutput,
    wethIsEth?: boolean,
) {
    expect(txOutput.transactionReceipt.status).to.eq('success');

    const amountsWithoutBpt = [...removeLiquidityQueryOutput.amountsOut].filter(
        (t) => t.token.address !== poolState.address,
    );

    const expectedDeltas = [
        ...amountsWithoutBpt.map((a) => a.amount),
        removeLiquidityQueryOutput.bptIn.amount,
        0n,
    ];

    if (wethIsEth) {
        const nativeAssetIndex = amountsWithoutBpt.findIndex((a) =>
            a.token.isSameAddress(
                NATIVE_ASSETS[removeLiquidityInput.chainId].wrapped,
            ),
        );
        expectedDeltas[expectedDeltas.length - 1] =
            expectedDeltas[nativeAssetIndex];
        expectedDeltas[nativeAssetIndex] = 0n;
    }

    expect(txOutput.balanceDeltas).to.deep.eq(expectedDeltas);
}

export function assertRemoveLiquidityBuildCallOutput(
    removeLiquidityQueryOutput: RemoveLiquidityQueryOutput,
    removeLiquidityBuildCallOutput: RemoveLiquidityBuildCallOutput,
    isExactIn: boolean,
    slippage: Slippage,
    _protocolVersion: 3 = 3,
) {
    const minAmountsOut = isExactIn
        ? removeLiquidityQueryOutput.amountsOut.map((a) =>
              TokenAmount.fromRawAmount(
                  a.token,
                  slippage.applyTo(a.amount, -1),
              ),
          )
        : [...removeLiquidityQueryOutput.amountsOut];

    const maxBptIn = isExactIn
        ? ({ ...removeLiquidityQueryOutput.bptIn } as TokenAmount)
        : TokenAmount.fromRawAmount(
              removeLiquidityQueryOutput.bptIn.token,
              slippage.applyTo(removeLiquidityQueryOutput.bptIn.amount),
          );

    const to = AddressProvider.Router(removeLiquidityQueryOutput.chainId);

    const expectedBuildOutput: Omit<
        RemoveLiquidityBuildCallOutput,
        'callData'
    > = {
        minAmountsOut,
        maxBptIn,
        to,
        value: 0n,
    };

    const { callData, ...buildCheck } = removeLiquidityBuildCallOutput;
    expect(buildCheck).to.deep.eq(expectedBuildOutput);
}
