---
"@frontier-fi/sdk": minor
---

Strip legacy V2, CowAMM, AuraBAL, nested-pool, undeployed V3 modules, non-Frontier chains, and Balancer-prefixed symbols.

**Breaking changes**: `@frontier-fi/sdk` now targets Frontier V3 (`protocolVersion: 3`) exclusively on active Frontier deployments (`ChainId.SEPOLIA`) under Frontier-native naming. The `@balancer/sdk` npm alias (`"@balancer/sdk": "npm:@frontier-fi/sdk@..."`) is no longer drop-in compatible — import directly from `@frontier-fi/sdk` and update renamed symbols and configuration keys:

```ts
// Before (0.1.0)
import {
    BalancerApi,
    BalancerApiClient,
    type BalancerApiClientOptions,
    balancerV3Contracts,
    balancerRouterAbiExtended,
    balancerBatchRouterAbiExtended,
    balancerBufferRouterAbiExtended,
    balancerCompositeLiquidityRouterBoostedAbiExtended,
    weightedPoolFactoryAbiExtended_V3,
} from '@balancer/sdk';

// process.env.BALANCER_SDK_CLIENT_NAME / BALANCER_SDK_CLIENT_VERSION
// window.BALANCER_SDK_CLIENT_NAME / BALANCER_SDK_CLIENT_VERSION
const api = new BalancerApi('https://api.frontier.fi/graphql', ChainId.SEPOLIA);

// After (0.2.0)
import {
    API_ENDPOINT,
    FrontierApi,
    FrontierApiClient,
    type FrontierApiClientOptions,
    frontierContracts,
    frontierRouterAbiExtended,
    frontierBatchRouterAbiExtended,
    frontierBufferRouterAbiExtended,
    frontierCompositeLiquidityRouterBoostedAbiExtended,
    weightedPoolFactoryAbiExtended,
} from '@frontier-fi/sdk';

// process.env.FRONTIER_SDK_CLIENT_NAME / FRONTIER_SDK_CLIENT_VERSION
// window.FRONTIER_SDK_CLIENT_NAME / FRONTIER_SDK_CLIENT_VERSION
const api = new FrontierApi(API_ENDPOINT, ChainId.SEPOLIA);
```

Summary of breaking and runtime behavior changes:

- **Renamed exports**: `BalancerApi` → `FrontierApi`, `BalancerApiClient` → `FrontierApiClient`, `BalancerApiClientOptions` → `FrontierApiClientOptions`, `balancerV3Contracts` → `frontierContracts`, `balancerRouterAbiExtended` → `frontierRouterAbiExtended`, `balancerBatchRouterAbiExtended` → `frontierBatchRouterAbiExtended`, `balancerBufferRouterAbiExtended` → `frontierBufferRouterAbiExtended`, `balancerCompositeLiquidityRouterBoostedAbiExtended` → `frontierCompositeLiquidityRouterBoostedAbiExtended`, and `weightedPoolFactoryAbiExtended_V3` → `weightedPoolFactoryAbiExtended`.
- **Client headers & API endpoint**: Environment and `window` client metadata variables changed from `BALANCER_SDK_CLIENT_NAME` / `BALANCER_SDK_CLIENT_VERSION` to `FRONTIER_SDK_CLIENT_NAME` / `FRONTIER_SDK_CLIENT_VERSION` (unset old variables silently fall back to defaults), the default `x-graphql-client-name` header changed from `'balancer-sdk'` to `'frontier-sdk'`, and `API_ENDPOINT` / `TEST_API_ENDPOINT` changed from `'https://api.frontier.fi'` to `'https://api.frontier.fi/graphql'`.
- **Narrowed `ChainId` & chain maps**: Removed 22 non-Frontier `ChainId` members (`MAINNET`, `GOERLI`, `OPTIMISM`, `BSC`, `GNOSIS_CHAIN`, `POLYGON`, `SONIC`, `ZKSYNC_TESTNET`, `FANTOM`, `FRAXTAL`, `ZKSYNC`, `ZKEVM`, `BASE`, `MODE`, `ARBITRUM_ONE`, `AVALANCHE`, `BASE_GOERLI`, `MONAD`, `MONAD_TESTNET`, `HYPEREVM`, `PLASMA`, `X_LAYER`), retaining `ChainId.SEPOLIA` (`11155111`) across `CHAINS`, `NATIVE_ASSETS` (typed `Record<ChainId, NativeToken>`), `PERMIT2`, `API_CHAIN_NAMES`, and `frontierContracts`.
- **Narrowed `PoolType`**: Removed 11 unused members (`AaveLinear`, `ComposableStable`, `CowAmm`, `Fx`, `Gyro2`, `Gyro3`, `MetaStable`, `StableSurge`, `ReClamm`, `LiquidityBootstrapping`, `LiquidityBootstrappingFixedPrice`), retaining `GyroE`, `Stable`, and `Weighted`.
- **Removed V2, CowAMM, nested-pool, and undeployed V3 exports**:
  - Protocol versions `1` and `2` across `Swap`, `AddLiquidity`, `RemoveLiquidity`, `CreatePool`, `InitPool`, and `InitPoolDataProvider` (`protocolVersion` is now `3` only).
  - V2 & CowAMM types, helpers, relayer, encoders, constants, and ABIs: `SingleSwap`, `BatchSwapStep`, `JoinPoolRequest`, `ExitPoolRequest`, `RemoveLiquidityKind.Unbalanced` (`RemoveLiquidityUnbalancedInput`), `auraBalSwap` / `auraBalSwaps`, `Relayer`, `encoders`, `PoolKind`, `InitPoolAmountsComposableStable`, `balancerV2Contracts`, `VAULT_V2`, `BALANCER_RELAYER`, `BALANCER_QUERIES`, `WEIGHTED_POOL_FACTORY_BALANCER_V2`, `COMPOSABLE_STABLE_POOL_FACTORY`, `DEFAULT_FUND_MANAGMENT`, `AUTHORIZER`, `ADMIN_OF_AUTHORIZER`, `mapPoolType`, `utils/pool` helpers (`getPoolAddress`, `poolIsLinearPool`, `poolHasVirtualSupply`, `poolHasActualSupply`, `poolHasPercentFee`), and all V2 / CowAMM / batch-relayer ABI exports.
  - Nested-pool and unbalanced-via-swap modules: `AddLiquidityNested`, `RemoveLiquidityNested`, `NestedPoolState` (`NestedPoolStateV2`, `NestedPoolStateV3`, `NestedPoolV2`, `NestedPoolV3`), `mapPoolToNestedPoolStateV2`, `mapPoolToNestedPoolStateV3`, `BALANCER_COMPOSITE_LIQUIDITY_ROUTER_NESTED`, `balancerCompositeLiquidityRouterNestedAbi`, `balancerCompositeLiquidityRouterNestedAbiExtended`, `AddLiquidityKind.UnbalancedViaSwap`, `AddLiquidityUnbalancedViaSwap`, `Permit2Helper.signAddLiquidityNestedApproval`, `Permit2Helper.signAddLiquidityUnbalancedViaSwapApproval`, `PermitHelper.signRemoveLiquidityNestedApproval`, `PriceImpact.addLiquidityNested`, `PriceImpact.removeLiquidityNested`, and `PriceImpact.addLiquidityUnbalancedViaSwap`.
  - Undeployed V3 pool/hook/router factories, ABIs, `CreatePool` inputs, and `AddressProvider` getters (`LBP`, `FixedPriceLBP`, `ReClamm`, `StableSurge`, `MevCaptureHook`, `UnbalancedAddViaSwapRouter`, `Gyro2CLP`, `MockGyroEclp`).
- **Stricter API pool-type validation**: `InputValidator` now routes uppercase Frontier API pool types (`'WEIGHTED'`, `'STABLE'`, `'ECLP'`) to `InputValidatorWeighted`, `InputValidatorStable`, and `InputValidatorGyro` instead of falling back to `InputValidatorBase` with a warning.
