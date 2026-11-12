# Frontier SDK

[![npm version](https://img.shields.io/npm/v/@frontier-fi/sdk/latest.svg)](https://www.npmjs.com/package/@frontier-fi/sdk/v/latest)

SDK for Frontier, forked from Balancer SDK 6.2.1. The first Frontier package is
`@frontier-fi/sdk@0.1.0`. This release fixes existing consumer paths and retains the
inherited public API; it does not remove V2 support or replace consumers' Frontier
`AddressProvider` configuration.

## Installation

```sh
pnpm add @frontier-fi/sdk
```

Existing consumers can retain their `@balancer/sdk` imports with an npm alias:

```sh
pnpm add '@balancer/sdk@npm:@frontier-fi/sdk@0.1.0'
```

## Local Setup

`pnpm install`

### Requirements

- `fetch`

### Polyfill

If your platform does not support one of the required features, it is also possible to import a polyfill.

- `fetch` -> [node-fetch](https://github.com/node-fetch/node-fetch#providing-global-access)

## Testing

`pnpm test:release` runs the consumer regression suite without RPC access or Anvil.
`pnpm check-types:release` checks production sources. Release checks also build
the package and verify its CommonJS and ESM imports. These checks do not replace
transaction execution against a fork of Frontier's deployed contracts.

`pnpm test:no-integration` excludes fork integration tests and live API contract
tests (`*.integration.test.ts` and `*.contract.test.ts`). It still validates
configured deployments via RPC. `pnpm test:all` includes the live API tests;
their inherited Balancer pool fixtures require a compatible API and dataset.

`pnpm test`

Testing runs against a local anvil fork and requires the following RPC URL to be configured in your .env file:
```
ETHEREUM_RPC_URL
POLYGON_RPC_URL
FANTOM_RPC_URL
SEPOLIA_RPC_URL
```
### Anvil Client

To download and install the anvil client, run the following commands (MacOS):
- `curl -L https://foundry.paradigm.xyz | bash`
- `brew install libusb`
- `source /Users/$(whoami)/.zshenv`
- `foundryup`

## Releases

The `release.yml` workflow runs on pushes to `main` and can be retried manually
on `main`. Pending Changesets open a version PR; when none remain, it publishes
the version in `package.json` if that version is absent from npm. Releases use
`@frontier-fi/sdk@<version>` tags, avoiding the inherited Balancer tags.

For subsequent changes, run `pnpm changeset`, select `@frontier-fi/sdk`, and commit
the generated changeset with the fix. Merge the resulting version PR to publish.
Only stable versions are published to `latest` by this workflow.

Publishing runs the source typecheck, consumer tests, and `tsup` through
`prepublishOnly`. It uses the checked-in generated GraphQL types; refreshing
those types with `pnpm codegen` is a separate, reviewed source change.

One-time setup, matching the maths repository:

1. Install the `maxyz-actions` GitHub App on `frontier-fi/sdk`, grant contents and
   pull-request write access, and make `MAXYZ_ACTIONS_PRIVATE_KEY` available to
   the workflow.
2. Configure the GitHub environment `release` to allow deployments from `main`.
3. Bootstrap the npm package with an authenticated maintainer's initial
   `npm publish --access public` from a reviewed checkout after installing the
   locked dependencies. The package must exist before configuring its publisher.
4. Configure an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/)
   for `@frontier-fi/sdk`: organization `frontier-fi`, repository `sdk`, workflow
   `release.yml`, environment `release`, with direct `npm publish` allowed.
   Subsequent CI publications use OIDC and provenance, with no npm token secret.

## Upstream documentation

In-depth documentation on this SDK is available at [docs-v3.balancer.fi/developer-reference/sdk](https://docs-v3.balancer.fi/developer-reference/sdk/).
