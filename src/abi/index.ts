import { permit2Abi } from './permit2';
import {
    vaultAbi_V3,
    vaultExtensionAbi_V3,
    routerAbi_V3,
    batchRouterAbi_V3,
    compositeLiquidityRouterAbi_V3,
    bufferRouterAbi_V3,
    weightedPoolFactoryAbi_V3,
    stablePoolFactoryAbi_V3,
    gyroECLPPoolFactoryAbi_V3,
    weightedPoolAbi_V3,
    stablePoolAbi_V3,
    gyroECLPAbi_V3,
} from './v3';

export * from './permit2';
export * from './v3';

// Common ABIs

export const commonABIsV3 = [
    ...vaultAbi_V3,
    ...vaultExtensionAbi_V3,
    ...permit2Abi,
];

export const poolABIsV3 = [
    ...weightedPoolAbi_V3,
    ...stablePoolAbi_V3,
    ...gyroECLPAbi_V3,
];

// Routers ABIs Extended

export const frontierRouterAbiExtended = [
    ...routerAbi_V3,
    ...commonABIsV3,
    ...poolABIsV3,
];

export const frontierCompositeLiquidityRouterBoostedAbiExtended = [
    ...compositeLiquidityRouterAbi_V3,
    ...commonABIsV3,
    ...poolABIsV3,
];

export const frontierBufferRouterAbiExtended = [
    ...bufferRouterAbi_V3,
    ...commonABIsV3,
    ...poolABIsV3,
];

export const frontierBatchRouterAbiExtended = [
    ...batchRouterAbi_V3,
    ...commonABIsV3,
    ...poolABIsV3,
];

// Pool Factories ABIs Extended

export const weightedPoolFactoryAbiExtended = [
    ...weightedPoolFactoryAbi_V3,
    ...commonABIsV3,
];

export const stablePoolFactoryAbiExtended = [
    ...stablePoolFactoryAbi_V3,
    ...commonABIsV3,
];

export const gyroECLPPoolFactoryAbiExtended = [
    ...gyroECLPPoolFactoryAbi_V3,
    ...commonABIsV3,
];
