import { Hex, TestActions } from 'viem';
import {
    AddLiquidity,
    AddLiquidityBuildCallOutput,
    AddLiquidityInput,
    AddLiquidityKind,
    AddLiquidityProportionalInput,
    AddLiquidityQueryOutput,
    AddLiquiditySingleTokenInput,
    AddLiquidityUnbalancedInput,
    AddLiquidityV3BuildCallInput,
    Address,
    NATIVE_ASSETS,
    PoolState,
    Slippage,
    TokenAmount,
    Permit2Helper,
    ChainId,
    isSameAddress,
    PublicWalletClient,
    missingParameterError,
    Token,
} from 'src';
import { getTokensForBalanceCheck } from './getTokensForBalanceCheck';
import { TxOutput, sendTransactionGetBalances } from './helper';
import { AddLiquidityTxInput } from './types';
import { AddressProvider } from '@/entities/inputValidator/utils/addressProvider';

type AddLiquidityOutput = {
    addLiquidityQueryOutput: AddLiquidityQueryOutput;
    addLiquidityBuildCallOutput: AddLiquidityBuildCallOutput;
    txOutput: TxOutput;
};

async function sdkAddLiquidity({
    addLiquidity,
    addLiquidityInput,
    poolState,
    slippage,
    testAddress,
    wethIsEth,
    client,
    usePermit2Signatures,
}: {
    addLiquidity: AddLiquidity;
    addLiquidityInput: AddLiquidityInput;
    poolState: PoolState;
    slippage: Slippage;
    testAddress: Address;
    wethIsEth?: boolean;
    fromInternalBalance?: boolean;
    client: PublicWalletClient & TestActions;
    usePermit2Signatures?: boolean;
}): Promise<{
    addLiquidityBuildCallOutput: AddLiquidityBuildCallOutput;
    addLiquidityQueryOutput: AddLiquidityQueryOutput;
}> {
    const addLiquidityQueryOutput = await addLiquidity.query(
        addLiquidityInput,
        poolState,
    );

    const addLiquidityBuildInput: AddLiquidityV3BuildCallInput = {
        ...addLiquidityQueryOutput,
        slippage,
        wethIsEth: !!wethIsEth,
        userData: addLiquidityInput.userData ?? '0x',
    };

    let addLiquidityBuildCallOutput: AddLiquidityBuildCallOutput;

    if (usePermit2Signatures) {
        const permit2 = await Permit2Helper.signAddLiquidityApproval({
            ...addLiquidityBuildInput,
            client,
            owner: testAddress,
        });

        addLiquidityBuildCallOutput = addLiquidity.buildCallWithPermit2(
            addLiquidityBuildInput,
            permit2,
        );
    } else {
        addLiquidityBuildCallOutput = addLiquidity.buildCall(
            addLiquidityBuildInput,
        );
    }

    return {
        addLiquidityBuildCallOutput,
        addLiquidityQueryOutput,
    };
}

function getCheck(output: AddLiquidityQueryOutput) {
    const { bptOut, amountsIn, ...check } = output;

    switch (output.addLiquidityKind) {
        case AddLiquidityKind.Proportional:
            return { ...check };
        case AddLiquidityKind.SingleToken:
            return { ...check, bptOut };
        case AddLiquidityKind.Unbalanced:
            return { ...check, amountsIn };
    }
}

export async function doAddLiquidity(txInput: AddLiquidityTxInput) {
    const {
        addLiquidity,
        poolState,
        addLiquidityInput,
        testAddress,
        client,
        slippage,
        wethIsEth,
        usePermit2Signatures,
    } = txInput;

    const { addLiquidityQueryOutput, addLiquidityBuildCallOutput } =
        await sdkAddLiquidity({
            addLiquidity,
            addLiquidityInput,
            poolState,
            slippage,
            testAddress,
            wethIsEth,
            usePermit2Signatures,
            client,
        });

    const tokens = getTokensForBalanceCheck(poolState);

    const txOutput = await sendTransactionGetBalances(
        tokens,
        client,
        testAddress,
        addLiquidityBuildCallOutput.to,
        addLiquidityBuildCallOutput.callData,
        addLiquidityBuildCallOutput.value,
    );

    return {
        addLiquidityQueryOutput,
        addLiquidityBuildCallOutput,
        txOutput,
    };
}

export function assertAddLiquidityUnbalanced(
    poolState: PoolState,
    addLiquidityInput: AddLiquidityUnbalancedInput,
    addLiquidityOutput: AddLiquidityOutput,
    slippage: Slippage,
    chainId: ChainId,
    protocolVersion: 3 = 3,
    wethIsEth?: boolean,
) {
    const { txOutput, addLiquidityQueryOutput, addLiquidityBuildCallOutput } =
        addLiquidityOutput;

    const expectedAmountsIn = poolState.tokens.map((t) => {
        const token = new Token(
            addLiquidityInput.chainId,
            t.address,
            t.decimals,
        );
        const input = addLiquidityInput.amountsIn.find(
            (a) => a.address === t.address,
        );
        if (input === undefined) return TokenAmount.fromRawAmount(token, 0n);
        return TokenAmount.fromRawAmount(token, input.rawAmount);
    });

    const expectedQueryOutput: Omit<AddLiquidityQueryOutput, 'bptOut'> & {
        userData: Hex;
    } = {
        to: AddressProvider.Router(chainId),
        amountsIn: expectedAmountsIn,
        tokenInIndex: undefined,
        poolId: poolState.id,
        poolType: poolState.type,
        addLiquidityKind: addLiquidityInput.kind,
        protocolVersion: poolState.protocolVersion,
        chainId: addLiquidityInput.chainId,
        userData: '0x',
    };

    const queryCheck = getCheck(addLiquidityQueryOutput);

    expect(queryCheck).to.deep.eq(expectedQueryOutput);
    expect(addLiquidityQueryOutput.bptOut.amount > 0n).to.be.true;

    assertAddLiquidityBuildCallOutput(
        addLiquidityInput,
        addLiquidityQueryOutput,
        addLiquidityBuildCallOutput,
        true,
        slippage,
        protocolVersion,
        wethIsEth,
    );

    assertTokenDeltas(
        poolState,
        addLiquidityInput,
        addLiquidityQueryOutput,
        addLiquidityBuildCallOutput,
        txOutput,
        wethIsEth,
    );
}

export function assertAddLiquiditySingleToken(
    poolState: PoolState,
    addLiquidityInput: AddLiquiditySingleTokenInput,
    addLiquidityOutput: AddLiquidityOutput,
    slippage: Slippage,
    chainId: ChainId,
    protocolVersion: 3 = 3,
    wethIsEth?: boolean,
) {
    const { txOutput, addLiquidityQueryOutput, addLiquidityBuildCallOutput } =
        addLiquidityOutput;

    if (addLiquidityQueryOutput.tokenInIndex === undefined)
        throw missingParameterError(
            'Add Liquidity SingleToken',
            'tokenInIndex',
            protocolVersion,
        );

    const bptToken = new Token(
        addLiquidityInput.chainId,
        poolState.address,
        18,
    );

    const tokensWithoutBpt = poolState.tokens.filter(
        (t) => t.address !== poolState.address,
    );

    const expectedQueryOutput: Omit<AddLiquidityQueryOutput, 'amountsIn'> & {
        userData: Hex;
    } = {
        to: AddressProvider.Router(chainId),
        bptOut: TokenAmount.fromRawAmount(
            bptToken,
            addLiquidityInput.bptOut.rawAmount,
        ),
        tokenInIndex: tokensWithoutBpt.findIndex(
            (t) => t.address === addLiquidityInput.tokenIn,
        ),
        poolId: poolState.id,
        poolType: poolState.type,
        addLiquidityKind: addLiquidityInput.kind,
        protocolVersion: poolState.protocolVersion,
        chainId: addLiquidityInput.chainId,
        userData: '0x',
    };

    const queryCheck = getCheck(addLiquidityQueryOutput);

    expect(queryCheck).to.deep.eq(expectedQueryOutput);

    addLiquidityQueryOutput.amountsIn.forEach((a) => {
        if (isSameAddress(a.token.address, addLiquidityInput.tokenIn)) {
            expect(a.amount > 0n).to.be.true;
        } else {
            expect(a.amount).toEqual(0n);
        }
    });

    assertAddLiquidityBuildCallOutput(
        addLiquidityInput,
        addLiquidityQueryOutput,
        addLiquidityBuildCallOutput,
        false,
        slippage,
        protocolVersion,
        wethIsEth,
    );

    assertTokenDeltas(
        poolState,
        addLiquidityInput,
        addLiquidityQueryOutput,
        addLiquidityBuildCallOutput,
        txOutput,
        wethIsEth,
    );
}

export function assertAddLiquidityProportional(
    poolState: PoolState,
    addLiquidityInput: AddLiquidityProportionalInput,
    addLiquidityOutput: AddLiquidityOutput,
    slippage: Slippage,
    chainId: ChainId,
    protocolVersion: 3 = 3,
    wethIsEth?: boolean,
) {
    const { txOutput, addLiquidityQueryOutput, addLiquidityBuildCallOutput } =
        addLiquidityOutput;

    const expectedQueryOutput: Omit<
        AddLiquidityQueryOutput,
        'bptOut' | 'amountsIn'
    > & {
        userData: Hex;
    } = {
        to: AddressProvider.Router(chainId),
        tokenInIndex: undefined,
        poolId: poolState.id,
        poolType: poolState.type,
        addLiquidityKind: addLiquidityInput.kind,
        protocolVersion: poolState.protocolVersion,
        chainId: addLiquidityInput.chainId,
        userData: '0x',
    };

    const queryCheck = getCheck(addLiquidityQueryOutput);

    expect(queryCheck).to.deep.eq(expectedQueryOutput);

    if (
        addLiquidityQueryOutput.bptOut.token.isSameAddress(
            addLiquidityInput.referenceAmount.address,
        )
    ) {
        expect(addLiquidityQueryOutput.bptOut.amount).toEqual(
            addLiquidityInput.referenceAmount.rawAmount,
        );
    } else {
        addLiquidityQueryOutput.amountsIn.forEach((a) => {
            if (
                a.token.isSameAddress(addLiquidityInput.referenceAmount.address)
            )
                expect(
                    Number(
                        a.amount - addLiquidityInput.referenceAmount.rawAmount,
                    ),
                ).closeTo(0, 1000);
        });
    }

    addLiquidityQueryOutput.amountsIn.forEach((a) => {
        if (a.token.address === poolState.address) expect(a.amount).toEqual(0n);
        else expect(a.amount > 0n).to.be.true;
    });

    assertAddLiquidityBuildCallOutput(
        addLiquidityInput,
        addLiquidityQueryOutput,
        addLiquidityBuildCallOutput,
        false,
        slippage,
        protocolVersion,
        wethIsEth,
    );

    if (wethIsEth) {
        expect(
            addLiquidityOutput.addLiquidityQueryOutput.amountsIn.some((t) =>
                t.token.isSameAddress(
                    NATIVE_ASSETS[addLiquidityInput.chainId].wrapped,
                ),
            ),
        ).to.be.true;
    }

    assertTokenDeltas(
        poolState,
        addLiquidityInput,
        addLiquidityQueryOutput,
        addLiquidityBuildCallOutput,
        txOutput,
        wethIsEth,
    );
}

function assertTokenDeltas(
    poolState: PoolState,
    addLiquidityInput: AddLiquidityInput,
    addLiquidityQueryOutput: AddLiquidityQueryOutput,
    addLiquidityBuildCallOutput: AddLiquidityBuildCallOutput,
    txOutput: TxOutput,
    wethIsEth?: boolean,
) {
    expect(txOutput.transactionReceipt.status).to.eq('success');

    const amountsWithoutBpt = [...addLiquidityQueryOutput.amountsIn].filter(
        (t) => t.token.address !== poolState.address,
    );

    const expectedDeltas = [
        ...amountsWithoutBpt.map((a) => a.amount),
        addLiquidityQueryOutput.bptOut.amount,
        0n,
    ];

    if (wethIsEth) {
        const nativeAssetIndex = amountsWithoutBpt.findIndex((a) =>
            a.token.isSameAddress(
                NATIVE_ASSETS[addLiquidityInput.chainId].wrapped,
            ),
        );
        expectedDeltas[nativeAssetIndex] = 0n;
        expectedDeltas[expectedDeltas.length - 1] =
            addLiquidityBuildCallOutput.value;
    }

    expect(txOutput.balanceDeltas).to.deep.eq(expectedDeltas);
}

function assertAddLiquidityBuildCallOutput(
    addLiquidityInput: AddLiquidityInput,
    addLiquidityQueryOutput: AddLiquidityQueryOutput,
    addLiquidityBuildCallOutput: AddLiquidityBuildCallOutput,
    isExactIn: boolean,
    slippage: Slippage,
    _protocolVersion: 3 = 3,
    wethIsEth?: boolean,
) {
    const maxAmountsIn = isExactIn
        ? [...addLiquidityQueryOutput.amountsIn]
        : addLiquidityQueryOutput.amountsIn.map((a) =>
              TokenAmount.fromRawAmount(a.token, slippage.applyTo(a.amount)),
          );

    const minBptOut = isExactIn
        ? TokenAmount.fromRawAmount(
              addLiquidityQueryOutput.bptOut.token,
              slippage.applyTo(addLiquidityQueryOutput.bptOut.amount, -1),
          )
        : ({ ...addLiquidityQueryOutput.bptOut } as TokenAmount);

    const to = AddressProvider.Router(addLiquidityInput.chainId);

    let value = 0n;
    if (wethIsEth) {
        value =
            addLiquidityQueryOutput.amountsIn.find((a) =>
                a.token.isSameAddress(
                    NATIVE_ASSETS[addLiquidityInput.chainId].wrapped,
                ),
            )?.amount ?? 0n;
    }

    const expectedBuildOutput: Omit<AddLiquidityBuildCallOutput, 'callData'> = {
        maxAmountsIn,
        minBptOut,
        to,
        value,
    };

    const { callData, ...buildCheck } = addLiquidityBuildCallOutput;
    expect(buildCheck).to.deep.eq(expectedBuildOutput);
}
