# 3D ChessMaster

A realtime 3D chess app built with Next.js 16, Clerk, Convex, Three.js,
Stockfish, shadcn/ui, and Vercel Eve.

## What is implemented

- Clerk sign-in and protected game routes.
- Convex-backed player profiles, matchmaking, realtime games, legal move
  validation, ratings, and tutor usage records.
- A Three.js board with pointer and keyboard controls.
- Five Stockfish practice levels using the lightweight browser WebAssembly
  engine.
- A signed-in Eve game companion that receives no private board state.
- A separate Eve AI Tutor whose entire route is guarded by Clerk's
  `ai_tutor` feature.
- Clerk Billing with a Free plan and Pro at $9.99/month or $99/year.

## Entitlement architecture

Clerk is the sole authority for plans and Pro access. The Tutor Eve channel
calls Clerk on every authenticated request and rejects users who do not have
the `ai_tutor` feature. Convex does not store a plan, subscription status, or
authoritative entitlement snapshot. It stores only application data such as
game ownership, tutor sessions, and usage events.

## Requirements

- Node.js 24 or newer (required by Eve)
- pnpm 10
- A Clerk app with the `convex` JWT template
- A Convex deployment
- Vercel AI Gateway access for deployed Eve agents

## Environment

Copy `.env.example` to `.env.local` and fill in the values. `.env.local` is
intentionally ignored by Git, so editors may hide or dim it as an ignored
file. In VS Code, enable **Explorer: Exclude Git Ignore** only if you want
ignored files hidden; otherwise it appears normally in the Explorer.

The existing local setup requires no extra Convex API key. Convex uses the
deployment URL in the browser and validates Clerk JWTs through
`convex/auth.config.ts`.

`CLERK_AUTHORIZED_PARTIES` is strongly recommended in production. Use a
comma-separated list of the exact app origins that may present Clerk session
tokens to the Eve services.

## Development

```bash
pnpm install
pnpm exec convex dev
pnpm dev
```

`pnpm dev` starts Next.js and both named Eve services through `withEve`.
Keep `pnpm exec convex dev` running in a separate terminal while developing so
Convex can sync backend function and schema changes to the active deployment.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm eve:build
pnpm build
```

The Stockfish browser assets are licensed under GPLv3. See
[`ATTRIBUTIONS.md`](./ATTRIBUTIONS.md).
