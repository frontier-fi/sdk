import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        define: {
            'process.env.SEPOLIA_RPC_URL': JSON.stringify(env.SEPOLIA_RPC_URL),
            'process.env.BASE_RPC_URL': JSON.stringify(env.BASE_RPC_URL),
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
            // Limit concurrent forks to avoid overwhelming RPC providers with too many connections
            // Each fork creates its own Anvil instance which makes RPC calls
            poolOptions: {
                forks: {
                    maxForks: 3,
                    minForks: 1,
                },
            },
            // Uncomment to debug suite excluding some tests
            // exclude: ['test/*weighted*.integration.*', 'node_modules', 'dist'],
            // Uncomment to run integration tests sequentially
            // threads: false,
        },
        plugins: [tsconfigPaths()],
    };
});
