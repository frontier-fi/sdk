import { CreatePoolTxInput } from './types';
import {
    CreatePool,
    Address,
    PoolType,
    weightedPoolFactoryAbiExtended,
    stablePoolFactoryAbiExtended,
    gyroECLPPoolFactoryAbiExtended,
} from 'src';
import { findEventInReceiptLogs } from './findEventInReceiptLogs';

export async function doCreatePool(
    txInput: CreatePoolTxInput,
): Promise<Address> {
    const { client, createPoolInput, testAddress } = txInput;

    const createPool = new CreatePool();
    const { callData, to } = createPool.buildCall(createPoolInput);

    const abis = {
        3: {
            [PoolType.Weighted]: weightedPoolFactoryAbiExtended,
            [PoolType.Stable]: stablePoolFactoryAbiExtended,
            [PoolType.GyroE]: gyroECLPPoolFactoryAbiExtended,
        },
    };

    const hash = await client.sendTransaction({
        to,
        data: callData,
        account: testAddress,
        chain: client.chain,
    });

    const transactionReceipt = await client.waitForTransactionReceipt({
        hash,
    });
    const poolCreatedEvent = findEventInReceiptLogs({
        receipt: transactionReceipt,
        eventName: 'PoolCreated',
        abi: abis[createPoolInput.protocolVersion][createPoolInput.poolType],
        to,
    });

    const {
        args: { pool: poolAddress },
    } = poolCreatedEvent;

    return poolAddress as Address;
}
