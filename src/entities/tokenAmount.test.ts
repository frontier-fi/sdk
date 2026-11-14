// pnpm test tokenAmount.test.ts

import {
    ChainId,
    type FixedPointFunction,
    MathSol,
    NATIVE_ASSETS,
    ONE_36,
    RAY,
    Token,
    TokenAmount,
    WAD,
} from '@frontier-fi/sdk';
import { parseUnits } from 'viem';

const weth = NATIVE_ASSETS[ChainId.SEPOLIA];

it('fromRawAmount', () => {
    const rawAmount = parseUnits('1.23456789123456789', weth.decimals);
    const tokenAmount = TokenAmount.fromRawAmount(weth, rawAmount);

    expect(tokenAmount.amount).toEqual(rawAmount);
    expect(tokenAmount.scalar).toEqual(1n);
    expect(tokenAmount.token).toEqual(weth);
});

it('toInputAmount', () => {
    const rawAmount = parseUnits('3.123456789123456789', weth.decimals);
    const tokenAmount = TokenAmount.fromRawAmount(weth, rawAmount);
    const inputAmount = tokenAmount.toInputAmount();

    expect(inputAmount.address).toBe(weth.address);
    expect(inputAmount.decimals).toBe(weth.decimals);
    expect(inputAmount.rawAmount).toBe(rawAmount);
});

describe('toSignificant & toExact', () => {
    it('should format amounts', () => {
        const rawAmount = parseUnits('2.123456789123456789', weth.decimals);
        const tokenAmount = TokenAmount.fromRawAmount(weth, rawAmount);

        expect(tokenAmount.toSignificant(weth.decimals)).toEqual(
            '2.123456789123456789',
        );
        expect(tokenAmount.toExact()).toEqual('2.123456789123456789');
    });

    it('should format small amounts preserving significant digits', () => {
        const smallRawAmount = parseUnits(
            '0.000000312457062375',
            weth.decimals,
        );
        const smallTokenAmount = TokenAmount.fromRawAmount(
            weth,
            smallRawAmount,
        );

        expect(smallTokenAmount.toSignificant(weth.decimals)).toEqual(
            '0.000000312457062375',
        );
        expect(smallTokenAmount.toSignificant(6)).toEqual('0.000000312457');
        expect(smallTokenAmount.toExact()).toEqual('0.000000312457062375');
    });
});

describe('maths@0.2.1 primitives & validation', () => {
    it('enforces token equality on add/sub and exact zero ceiling division', () => {
        const a = TokenAmount.fromRawAmount(weth, 100n);
        const otherToken = new Token(
            ChainId.SEPOLIA,
            '0x0000000000000000000000000000000000000001',
            18,
        );
        const b = TokenAmount.fromRawAmount(otherToken, 100n);

        expect(() => a.add(b)).toThrow('Token mismatch');
        expect(() => a.sub(b)).toThrow('Token mismatch');
        expect(TokenAmount.fromRawAmount(weth, 0n).mulUpFixed(WAD).amount).toBe(
            0n,
        );
    });

    it('exports corrected RAY (1e27), ONE_36 (1e36), and MathSol.powDownFixed rounding', () => {
        expect(RAY).toBe(10n ** 27n);
        expect(ONE_36).toBe(10n ** 36n);
        const x = 1500000000000000001n; // 1.5 + 1e-18
        expect(MathSol.powDownFixed(x, 2n * WAD)).toBe(
            MathSol.mulDownFixed(x, x),
        );
    });

    it('throws RangeError on zero denominators across MathSol division helpers', () => {
        expect(() => MathSol.divUp(1n, 0n)).toThrow(RangeError);
        expect(() => MathSol.divUp(0n, 0n)).toThrow(RangeError);
        expect(() => MathSol.divDownFixed(1n, 0n)).toThrow(RangeError);
        expect(() => MathSol.divDownFixed(0n, 0n)).toThrow(RangeError);
        expect(() => MathSol.divUpFixed(1n, 0n)).toThrow(RangeError);
        expect(() => MathSol.divUpFixed(0n, 0n)).toThrow(RangeError);
        expect(() => MathSol.mulDivUpFixed(1n, WAD, 0n)).toThrow(RangeError);
        expect(() => MathSol.mulDivUpFixed(0n, WAD, 0n)).toThrow(RangeError);
    });

    it('supports detached MathSol static helpers as FixedPointFunction callbacks', () => {
        const divideUpFixed: FixedPointFunction = MathSol.divUpFixed;
        const divideDownFixed: FixedPointFunction = MathSol.divDownFixed;
        const multiplyUpFixed: FixedPointFunction = MathSol.mulUpFixed;
        const multiplyDownFixed: FixedPointFunction = MathSol.mulDownFixed;
        const divideUp: FixedPointFunction = MathSol.divUp;

        expect(divideUpFixed(1n, 2n)).toBe(500000000000000000n);
        expect(divideDownFixed(1n, 2n)).toBe(500000000000000000n);
        expect(multiplyUpFixed(2n * WAD, 3n * WAD)).toBe(6n * WAD);
        expect(multiplyDownFixed(2n * WAD, 3n * WAD)).toBe(6n * WAD);
        expect(divideUp(5n, 2n)).toBe(3n);
    });
});
