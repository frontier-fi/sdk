import { PathWithAmount } from './pathWithAmount';
import { TokenAmount } from '../../tokenAmount';
import {
    inputValidationError,
    isSameAddress,
    protocolVersionError,
} from '@/utils';
import { Path } from './types';
import { Address } from 'viem';

export function getInputAmount(paths: PathWithAmount[]): TokenAmount {
    if (
        !paths.every((p) =>
            p.inputAmount.token.isEqual(paths[0].inputAmount.token),
        )
    ) {
        throw inputValidationError(
            'Swap',
            'Input amount can only be calculated if all paths have the same input token.',
        );
    }
    const amounts = paths.map((path) => path.inputAmount);
    return amounts.reduce((a, b) => a.add(b));
}

export function getOutputAmount(paths: PathWithAmount[]): TokenAmount {
    if (
        !paths.every((p) =>
            p.outputAmount.token.isEqual(paths[0].outputAmount.token),
        )
    ) {
        throw inputValidationError(
            'Swap',
            'Output amount can only be calculated if all paths have the same output token.',
        );
    }
    const amounts = paths.map((path) => path.outputAmount);
    return amounts.reduce((a, b) => a.add(b));
}

export function validatePaths(paths: Path[]) {
    if (paths.length === 0)
        throw inputValidationError('Swap', 'Must contain at least 1 path.');

    if (paths.some((p) => p.pools.length === 0))
        throw inputValidationError(
            'Swap',
            'All paths must contain at least 1 pool.',
        );

    if (paths.some((p) => p.tokens.length < 2))
        throw inputValidationError(
            'Swap',
            'All paths must contain at least 2 tokens.',
        );

    if (paths.some((p) => p.tokens.length !== p.pools.length + 1))
        throw inputValidationError(
            'Swap',
            'All paths must contain tokens length equal pools length + 1',
        );

    const invalidVersionPath = paths.find((p) => p.protocolVersion !== 3);
    if (invalidVersionPath) {
        throw protocolVersionError('Swap', invalidVersionPath.protocolVersion);
    }

    validateBufferLength(paths);

    const tokenIn = paths[0].tokens[0].address.toLowerCase();
    if (paths.some((p) => p.tokens[0].address.toLowerCase() !== tokenIn))
        throw inputValidationError(
            'Swap',
            'All paths must start with same token.',
        );

    const tokenOut =
        paths[0].tokens[paths[0].tokens.length - 1].address.toLowerCase();
    if (
        paths.some(
            (p) =>
                p.tokens[p.tokens.length - 1].address.toLowerCase() !==
                tokenOut,
        )
    )
        throw inputValidationError(
            'Swap',
            'All paths must end with same token.',
        );
}

function validateBufferLength(paths: Path[]) {
    if (
        !paths.every((p) => {
            return p.isBuffer ? p.isBuffer.length === p.pools.length : true;
        })
    ) {
        throw inputValidationError(
            'Swap',
            'buffers and pools must have same length.',
        );
    }
}

export function isBatchSwap(
    paths: Path[],
    inputToken: Address,
    outputToken: Address,
): boolean {
    return (
        paths.length > 1 ||
        paths[0].pools.length > 1 ||
        isSameAddress(paths[0].pools[0], inputToken) ||
        isSameAddress(paths[0].pools[0], outputToken)
    );
}
