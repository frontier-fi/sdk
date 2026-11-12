import { BalancerApi, ChainId, API_ENDPOINT } from '../../../src';

// Client options are local checks; network queries live in the integration suite.
describe('BalancerApi client configuration', () => {
    test('Should support configuring client name and version', async () => {
        const chainId = ChainId.MAINNET;

        // Custom client options
        const options = {
            clientName: 'test-client',
            clientVersion: '1.2.3',
        };

        // API with custom client options
        const balancerApi = new BalancerApi(API_ENDPOINT, chainId, options);

        // Verify client properties
        expect(balancerApi.balancerApiClient.clientName).toEqual(
            options.clientName,
        );
        expect(balancerApi.balancerApiClient.clientVersion).toEqual(
            options.clientVersion,
        );
    });

    test('Should use default client name and version when not specified', async () => {
        const chainId = ChainId.MAINNET;

        // API without custom client options
        const balancerApi = new BalancerApi(API_ENDPOINT, chainId);

        // Verify default client properties
        expect(balancerApi.balancerApiClient.clientName).toEqual(
            'balancer-sdk',
        );
        // The version should match the package version
        expect(typeof balancerApi.balancerApiClient.clientVersion).toEqual(
            'string',
        );
        expect(
            balancerApi.balancerApiClient.clientVersion.length,
        ).toBeGreaterThan(0);
        // Version should be either package version or fallback in tests
        // Check for semver format (x.y.z)
        expect(balancerApi.balancerApiClient.clientVersion).toMatch(
            /^\d+\.\d+\.\d+$/,
        );
    });

    test('Should prioritize explicit options over environment variables', async () => {
        const chainId = ChainId.MAINNET;

        // Save original environment variables
        const originalName = process.env.BALANCER_SDK_CLIENT_NAME;
        const originalVersion = process.env.BALANCER_SDK_CLIENT_VERSION;

        try {
            // Set environment variables
            process.env.BALANCER_SDK_CLIENT_NAME = 'env-client';
            process.env.BALANCER_SDK_CLIENT_VERSION = '9.9.9';

            // API with custom client options that should override env vars
            const options = {
                clientName: 'explicit-client',
                clientVersion: '5.5.5',
            };
            const balancerApi = new BalancerApi(API_ENDPOINT, chainId, options);

            // Verify explicit options are used
            expect(balancerApi.balancerApiClient.clientName).toEqual(
                options.clientName,
            );
            expect(balancerApi.balancerApiClient.clientVersion).toEqual(
                options.clientVersion,
            );
        } finally {
            // Restore original environment variables
            process.env.BALANCER_SDK_CLIENT_NAME = originalName;
            process.env.BALANCER_SDK_CLIENT_VERSION = originalVersion;
        }
    });
});
