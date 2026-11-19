import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const rpcDefines = Object.fromEntries(
        Object.entries(env)
            .filter(
                ([key]) => key === 'DRPC_API_KEY' || key.endsWith('_RPC_URL'),
            )
            .map(([key, value]) => [
                `process.env.${key}`,
                JSON.stringify(value),
            ]),
    );

    return {
        define: {
            ...rpcDefines,
            'process.env.SKIP_GLOBAL_SETUP': JSON.stringify(
                env.SKIP_GLOBAL_SETUP,
            ),
        },
        test: {
            testTimeout: 20_000,
            hookTimeout: 60_000,
            setupFiles: ['/test/vitest-setup.ts'],
            globals: true,
            pool: 'forks',
            // Limit concurrent workers to avoid overwhelming RPC providers with too many connections
            // Each fork creates its own Anvil instance which makes RPC calls
            maxWorkers: 2,
            // Uncomment to debug suite excluding some tests
            // exclude: ['test/*weighted*.integration.*', 'node_modules', 'dist'],
            // Uncomment to run integration tests sequentially
            // threads: false,
        },
        plugins: [tsconfigPaths()],
    };
});
