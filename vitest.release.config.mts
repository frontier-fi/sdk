import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import pkg from './package.json';

const root = fileURLToPath(new URL('.', import.meta.url));

// The existing consumer regression suite is independent of RPCs and Anvil.
// Fork execution remains a separate integration check.
export default defineConfig({
    define: { __PACKAGE_VERSION__: JSON.stringify(pkg.version) },
    resolve: {
        alias: {
            '@': `${root}src`,
            src: `${root}src`,
            test: `${root}test`,
            '@frontier-fi/sdk': `${root}src/index.ts`,
        },
    },
    test: {
        globals: true,
        maxWorkers: 1,
        include: [
            'src/entities/tokenAmount.test.ts',
            'test/slippage.test.ts',
            'test/inputValidator.test.ts',
            'test/swap.test.ts',
            'test/v3/swaps/swapV3.test.ts',
            'test/v3/swaps/frontierNative.test.ts',
            'test/v3/createPool/weighted/weighted.validation.test.ts',
            'test/v3/createPool/stable/stable.validation.test.ts',
            'test/v3/createPool/gyroECLP/gyroECLP.helpers.test.ts',
            'test/v3/createPool/gyroECLP/gyroECLP.validation.test.ts',
        ],
    },
});
