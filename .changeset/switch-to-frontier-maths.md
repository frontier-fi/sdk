---
"@frontier-fi/sdk": minor
---

Replace `@balancer-labs/balancer-maths` and duplicated local math and token primitives with `@frontier-fi/maths@0.2.0`.

**Breaking changes**: `MathSol`, `LogExpMath`, `WAD`, `RAY`, `ONE_36`, `MAX_UINT256`, `abs`, `min`, `max`, `Token`, `TokenAddress`, `InputToken`, `BigintIsh`, `TokenAmount`, `InputAmount`, and `DECIMAL_SCALES` are now re-exported directly from `@frontier-fi/maths@0.2.0` instead of duplicated local SDK implementations:

```ts
// Before
import { RAY, TWO_WAD } from '@frontier-fi/sdk';
// RAY was 10n ** 36n; TWO_WAD was 2n * 10n ** 18n

// After
import { ONE_36, RAY, WAD } from '@frontier-fi/sdk';
// RAY is now 10n ** 27n (standard DeFi ray); use ONE_36 for 10n ** 36n and 2n * WAD for TWO_WAD
```

Summary of behavioral and API changes from `@frontier-fi/maths@0.2.0`:

- **`RAY` fixed (`1e36` → `1e27`) & `ONE_36` added**: `RAY` is now `10n ** 27n` (`1e27`), and `ONE_36` (`10n ** 36n`) is exported for 36-decimal fixed-point math (`LogExpMath._ln_36` now uses `ONE_36`).
- **Removed internal math constants**: `TWO_WAD`, `FOUR_WAD`, and `HUNDRED_WAD` are no longer exported; use `2n * WAD`, `4n * WAD`, and `100n * WAD` instead. `LogExpMath`, `ONE_36`, `FixedPointFunction`, `MathSol.mulDivUpFixed`, `TokenAddress`, and `TokenAmount.toExact()` are newly exported.
- **`MathSol.powDownFixed` rounding fix**: `MathSol.powDownFixed(x, y)` now rounds down (`mulDownFixed`) instead of up (`mulUpFixed`) for `y === 2e18` and `y === 4e18`.
- **Stricter `TokenAmount` validation, arithmetic, and formatting**:
  - `TokenAmount.add` and `TokenAmount.sub` now throw `Error('Token mismatch: ...')` when `chainId`, `address`, or `decimals` differ between operands.
  - `TokenAmount` validates `token.decimals` is an integer in `0..18` (`RangeError`), rejects unsafe `number` inputs (`RangeError`), and rejects empty strings (`SyntaxError`).
  - `TokenAmount.toSignificant(significantDigits)` now preserves `significantDigits` significant figures on `< 1` values (e.g. `'0.000000312457'` for `significantDigits = 6` rather than truncating to `'0'`) and throws `RangeError` on negative or non-integer `significantDigits`; `SorSwapPaths` and callers needing full unrounded human-scale amounts use `TokenAmount.toExact()`.
  - `TokenAmount.mulUpFixed`, `divUpFixed`, and `fromScale18Amount(..., true)` use exact ceiling division (`0n` stays `0n` instead of returning `1n`).
