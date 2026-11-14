---
"@frontier-fi/sdk": minor
---

Remove remaining V2 constants, helpers, config types, and ComposableStable preminted-BPT code paths.

**Breaking changes**: Legacy V2 constants, array/swap helpers, unused per-pool-type V2 config parameters, V2 `sender`/`recipient` `buildCall` checks, and `AddLiquidityAmounts.maxAmountsInWithoutBpt` have been removed:

```ts
// Before
import {
    AddLiquidity,
    MAX_UINT112,
    PREMINTED_STABLE_BPT,
    SECONDS_PER_YEAR,
} from '@frontier-fi/sdk';
const addLiquidity = new AddLiquidity({ customAddLiquidityTypes: {} });

// After
import { AddLiquidity } from '@frontier-fi/sdk';
const addLiquidity = new AddLiquidity();
```

Summary of removed V2 exports and narrowed types:

- **Removed V2 constants**: `MAX_UINT112`, `PREMINTED_STABLE_BPT`, and `SECONDS_PER_YEAR`.
- **Removed V2 helpers & errors**: `checkInputs`, `removeIndex`, `insertIndex`, `exceedingParameterError`, and `poolTypeError`.
- **Removed unused V2 custom encoder configs**: `AddLiquidityConfig` (`customAddLiquidityTypes`), `RemoveLiquidityConfig` (`customRemoveLiquidityTypes`), and `InitPoolConfig` (`initPoolTypes`), along with the unused `config` constructor parameter on `AddLiquidity`, `RemoveLiquidity`, and `InitPool`.
- **Removed V2 preminted-BPT & 32-byte pool ID remnants**: Removed `AddLiquidityAmounts.maxAmountsInWithoutBpt` and `bptIndex` filtering in liquidity helpers, and narrowed `PoolState.id` (and balance/underlying variants), `AddLiquidityBaseQueryOutput.poolId`, and `Path.pools` to `Address` / `Address[]`.
