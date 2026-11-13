import { SwapKind } from '../../types';
import { TokenAmount } from '../tokenAmount';
import { Permit2 } from '../permit2Helper';
import { validatePaths } from './paths';
import { SwapV3 } from './swaps/v3';
import { SwapBase } from './swaps/types';
import {
    ExactInQueryOutput,
    ExactOutQueryOutput,
    SwapBuildCallInput,
    SwapBuildOutputExactIn,
    SwapBuildOutputExactOut,
    SwapInput,
} from './types';
import { InputValidator } from '../inputValidator/inputValidator';
import { Address } from 'viem';
import { exceedingParameterError, protocolVersionError } from '@/utils';

export * from './types';
export * from './paths';

// A Swap can be a single or multiple paths
export class Swap {
    private readonly swap: SwapBase;
    public protocolVersion: 3;

    public constructor(swapInput: SwapInput) {
        validatePaths(swapInput.paths);
        const _protocolVersion = swapInput.paths[0].protocolVersion;
        if (_protocolVersion !== 3) {
            throw protocolVersionError('Swap', _protocolVersion);
        }
        this.swap = new SwapV3(swapInput);
        this.protocolVersion = 3;
    }

    public get quote(): TokenAmount {
        return this.swap.swapKind === SwapKind.GivenIn
            ? this.outputAmount
            : this.inputAmount;
    }

    public get inputAmount(): TokenAmount {
        return this.swap.inputAmount;
    }

    public get outputAmount(): TokenAmount {
        return this.swap.outputAmount;
    }

    public get isBatchSwap(): boolean {
        return this.swap.isBatchSwap;
    }

    // rpcUrl is optional, but recommended to prevent rate limiting
    public async query(
        rpcUrl?: string,
        block?: bigint,
        sender?: Address,
    ): Promise<ExactInQueryOutput | ExactOutQueryOutput> {
        return this.swap.query(rpcUrl, block, sender);
    }

    public queryCallData(): string {
        return this.swap.queryCallData();
    }

    /**
     * Returns the transaction data to be sent to the router contract
     *
     * @param input
     * @returns
     */
    buildCall(
        input: SwapBuildCallInput,
    ): SwapBuildOutputExactIn | SwapBuildOutputExactOut {
        if ('sender' in input || 'recipient' in input) {
            throw exceedingParameterError('Swap', 'sender/recipient', 3);
        }
        return this.swap.buildCall(input);
    }

    buildCallWithPermit2(
        input: SwapBuildCallInput,
        permit2: Permit2,
    ): SwapBuildOutputExactIn | SwapBuildOutputExactOut {
        InputValidator.validateBuildCallWithPermit2({
            protocolVersion: this.protocolVersion,
        });
        return this.swap.buildCallWithPermit2(input, permit2);
    }
}
