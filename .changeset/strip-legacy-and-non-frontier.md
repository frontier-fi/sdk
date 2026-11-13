---
"@frontier-fi/sdk": patch
---

Strip legacy Balancer V2, CowAMM, AuraBAL, nested-pool, undeployed V3 contract/pool modules, non-Frontier chains, and Balancer-prefixed symbols.

`@frontier-fi/sdk` now targets Frontier V3 exclusively on active Frontier networks (`ChainId.SEPOLIA` `11155111`).

- Removed Balancer V2 (`protocolVersion: 2`), CowAMM (`protocolVersion: 1`), `auraBalSwaps`, `Relayer`, V2 `encoders`, `AddLiquidityNested` / `RemoveLiquidityNested` (`nestedPoolState`), `AddLiquidityKind.UnbalancedViaSwap`, and undeployed V3 pool/hook/router ABIs and factories (`LBP`, `FixedPriceLBP`, `ReClamm`, `StableSurge`, `MevCaptureHook`, `UnbalancedAddViaSwapRouter`, `Gyro2CLP`).
- Narrowed `ChainId`, `CHAINS`, `NATIVE_ASSETS`, `PERMIT2`, `API_CHAIN_NAMES`, and `frontierContracts` to active Frontier deployments (`SEPOLIA`).
- Replaced Balancer-prefixed exports with Frontier-only exports: `FrontierApi` (was `BalancerApi`), `FrontierApiClient` (was `BalancerApiClient`), `FrontierApiClientOptions` (was `BalancerApiClientOptions`), `frontierContracts` (was `balancerV3Contracts`), `frontierRouterAbiExtended`, `frontierBatchRouterAbiExtended`, `frontierBufferRouterAbiExtended`, and `frontierCompositeLiquidityRouterBoostedAbiExtended`.
