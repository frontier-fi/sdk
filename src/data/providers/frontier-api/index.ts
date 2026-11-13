import { Pools } from './modules/pool-state';
import { FrontierApiClient, FrontierApiClientOptions } from './client';
import { ChainId } from '../../../utils';
import { SorSwapPaths } from './modules/sorSwapPaths';
import { Buffers } from './modules/buffer-state';
import { BoostedPools } from './modules/boosted-pool-state';

export { FrontierApiClient, type FrontierApiClientOptions } from './client';
export { SorInput as GetQuoteInput } from './modules/sorSwapPaths';

export class FrontierApi {
    frontierApiClient: FrontierApiClient;
    pools: Pools;
    boostedPools: BoostedPools;
    sorSwapPaths: SorSwapPaths;
    buffers: Buffers;

    /**
     * Create a new instance of the Frontier API client
     *
     * @param frontierApiUrl The URL of the Frontier API endpoint
     * @param chainId The blockchain chain ID
     * @param options Optional client configuration for name and version
     */
    constructor(
        frontierApiUrl: string,
        chainId: ChainId,
        options?: FrontierApiClientOptions,
    ) {
        this.frontierApiClient = new FrontierApiClient(
            frontierApiUrl,
            chainId,
            options,
        );
        this.pools = new Pools(this.frontierApiClient);
        this.boostedPools = new BoostedPools(this.frontierApiClient);
        this.sorSwapPaths = new SorSwapPaths(this.frontierApiClient);
        this.buffers = new Buffers(this.frontierApiClient);
    }
}
