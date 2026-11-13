import { ChainId } from '../../../../utils';

/**
 * Window with Frontier SDK client config properties
 */
interface WindowWithConfig {
    FRONTIER_SDK_CLIENT_NAME?: string;
    FRONTIER_SDK_CLIENT_VERSION?: string;
}

/**
 * Client options for the Frontier API
 */
export interface FrontierApiClientOptions {
    /**
     * Custom client name to identify the application using the SDK
     */
    clientName?: string;
    /**
     * Custom client version to identify the version of the application using the SDK
     */
    clientVersion?: string;
}

/**
 * Client for the Frontier API that handles making GraphQL requests
 * with proper client headers. Works in both browser and Node.js
 * environments.
 */
export class FrontierApiClient {
    /** The URL of the Frontier API endpoint */
    apiUrl: string;
    /** The blockchain chain ID */
    chainId: ChainId;
    /** The name of the client application using the SDK */
    clientName: string;
    /** The version of the client application using the SDK */
    clientVersion: string;

    /**
     * Create a new Frontier API client
     *
     * @param apiUrl The URL of the Frontier API endpoint
     * @param chainId The chain ID
     * @param options Optional client configuration
     */
    constructor(
        apiUrl: string,
        chainId: ChainId,
        options?: FrontierApiClientOptions,
    ) {
        this.apiUrl = apiUrl;
        this.chainId = chainId;

        if (options?.clientName) {
            this.clientName = options.clientName;
        } else if (
            typeof process !== 'undefined' &&
            process?.env?.FRONTIER_SDK_CLIENT_NAME
        ) {
            this.clientName =
                process.env.FRONTIER_SDK_CLIENT_NAME || 'frontier-sdk';
        } else if (
            typeof window !== 'undefined' &&
            (window as WindowWithConfig).FRONTIER_SDK_CLIENT_NAME
        ) {
            this.clientName =
                (window as WindowWithConfig).FRONTIER_SDK_CLIENT_NAME ||
                'frontier-sdk';
        } else {
            this.clientName = 'frontier-sdk';
        }

        if (options?.clientVersion) {
            this.clientVersion = options.clientVersion;
        } else if (
            typeof process !== 'undefined' &&
            process?.env?.FRONTIER_SDK_CLIENT_VERSION
        ) {
            this.clientVersion =
                process.env.FRONTIER_SDK_CLIENT_VERSION || '0.0.0';
        } else if (
            typeof window !== 'undefined' &&
            (window as WindowWithConfig).FRONTIER_SDK_CLIENT_VERSION
        ) {
            this.clientVersion =
                (window as WindowWithConfig).FRONTIER_SDK_CLIENT_VERSION ||
                '0.0.0';
        } else {
            this.clientVersion =
                typeof __PACKAGE_VERSION__ !== 'undefined'
                    ? __PACKAGE_VERSION__
                    : '0.0.0';
        }
    }

    async fetch(requestQuery: {
        operationName?: string;
        query: string;
        variables?: Record<string, string | boolean | string[] | number>;
    }) {
        const response = await fetch(this.apiUrl, {
            method: 'post',
            body: JSON.stringify(requestQuery),
            headers: {
                'Content-Type': 'application/json',
                ChainId: this.chainId.toString(),
                'x-graphql-client-name': this.clientName,
                'x-graphql-client-version': this.clientVersion,
            },
        });
        return response.json();
    }
}
