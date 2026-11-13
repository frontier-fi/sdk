---
"@frontier-fi/sdk": minor
---

Strip legacy Balancer V2, CowAMM, AuraBAL, nested-pool, undeployed V3 contract/pool modules, non-Frontier chains, and Balancer-prefixed symbols.

**Breaking change**: `@frontier-fi/sdk` now targets Frontier V3 exclusively on `ChainId.BASE` (`8453`) and `ChainId.SEPOLIA` (`11155111`).

- Removed Balancer V2 (`protocolVersion: 2`), CowAMM (`protocolVersion: 1`), `auraBalSwaps`, `Relayer`, V2 `encoders`, `AddLiquidityNested` / `RemoveLiquidityNested` (`nestedPoolState`), `AddLiquidityKind.UnbalancedViaSwap`, and undeployed V3 pool/hook/router ABIs and factories (`LBP`, `FixedPriceLBP`, `ReClamm`, `StableSurge`, `MevCaptureHook`, `UnbalancedAddViaSwapRouter`, `Gyro2CLP`).
- Narrowed `ChainId`, `CHAINS`, `NATIVE_ASSETS`, `PERMIT2`, and `API_CHAIN_NAMES` to `BASE` and `SEPOLIA`.
- Replaced Balancer-prefixed exports with Frontier-only exports: use `FrontierApi` (was `BalancerApi`), `FrontierApiClient` (was `BalancerApiClient`), `FrontierApiClientOptions` (was `BalancerApiClientOptions`), `frontierContracts` (was `balancerV3Contracts`), `frontierRouterAbiExtended`, `frontierBatchRouterAbiExtended`, `frontierBufferRouterAbiExtended`, and `frontierCompositeLiquidityRouterBoostedAbiExtended`.
