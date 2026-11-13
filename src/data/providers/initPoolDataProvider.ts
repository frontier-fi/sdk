import { Address, PublicClient, createPublicClient, http } from 'viem';
import { CHAINS, protocolVersionError } from '../../utils';
import { PoolState } from '../../entities';
import { getPoolTokensV3, getTokenDecimals } from '../../utils/tokens';

export class InitPoolDataProvider {
    private readonly client: PublicClient;

    constructor(
        private readonly chainId: number,
        private readonly rpcUrl: string,
    ) {
        this.client = createPublicClient({
            transport: http(this.rpcUrl, { timeout: 60_000 }),
            chain: CHAINS[this.chainId],
        });
    }

    public async getInitPoolData(
        poolAddress: Address,
        poolType: string,
        protocolVersion: 3 = 3,
    ): Promise<PoolState> {
        if (protocolVersion !== 3) {
            throw protocolVersionError('InitPoolDataProvider', protocolVersion);
        }
        const poolTokensFromVault: Address[] = await getPoolTokensV3(
            poolAddress,
            this.client,
        );

        const poolTokens = await Promise.all(
            poolTokensFromVault.map(async (address, index) => {
                const decimals = await getTokenDecimals(address, this.client);
                return {
                    address: address.toLowerCase() as Address,
                    index,
                    decimals,
                };
            }),
        );
        return {
            id: poolAddress,
            address: poolAddress.toLowerCase() as Address,
            type: poolType,
            tokens: poolTokens,
            protocolVersion: 3,
        };
    }
}
