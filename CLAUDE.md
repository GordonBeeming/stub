# CLAUDE.md — agent guide for the `stub` monorepo

This file tells coding agents (Claude Code, etc.) how to work in this repo without drifting from the intended design and architecture. Read it fully before making any non-trivial change.

## Repo structure

This is a pnpm + Turborepo monorepo:

```
stub/
├── apps/
│   └── app/                # Next.js (App Router) via @opennextjs/cloudflare
│                           # hosts the app at / AND marketing at /stub/*
├── packages/
│   └── design-system/      # Shared React components, tokens, Tailwind preset
├── DESIGN.md               # Canonical design spec — source of truth
└── CLAUDE.md               # This file
```

Single deploy: one Worker at `stub.gordonbeeming.com`, marketing pages served at `/stub/*` on the same Worker. The blog's Cloudflare Worker (`cloudflare-xylem-worker`) proxies `gordonbeeming.com/stub` → `stub.gordonbeeming.com/stub` so the canonical marketing URL reads as `gordonbeeming.com/stub`. A middleware rule on this Worker 301s any direct hit to `stub.gordonbeeming.com/stub*` back to the canonical `gordonbeeming.com/stub*`.

When the user asks you to change the design, update `DESIGN.md` **first**, then make the code match. Not the other way around.

## Design system rules — read before writing any UI

1. **`DESIGN.md` is the source of truth.** Never introduce a color, font family, spacing value, border radius, component, or layout rule that isn't documented there. If you need something new, update `DESIGN.md` first and get user approval before implementing.

2. **Never reimplement a design-system component inside an app.** If `@gordonbeeming/design-system` exports `<Hero>`, `apps/app` imports it — it does not roll its own hero. If the component needs an escape hatch for a specific use, extend its props in the design system rather than forking.

3. **No arbitrary Tailwind values.** If the user has Tailwind configured, use the preset from `@gordonbeeming/design-system/tailwind-preset`. Never `bg-[#abcdef]` or `text-[13px]`. If a needed value is missing from the preset, add it to `DESIGN.md` + the preset, then use it.

4. **No new fonts.** Three fonts only: Inter (sans), JetBrains Mono (mono), Instrument Serif (serif). Load via Fontsource from the design-system package — never from Google Fonts CDN.

5. **Both themes ship.** Dark and light palettes live in `DESIGN.md` §2.1. System preference picks the default via `prefers-color-scheme`; the user can override with the `<ThemeToggle>` in the `<PageHeader>`, persisted to `localStorage` and applied pre-paint so there's no flash. Every style reads tokens — never literal hex. See `DESIGN.md` §9 for the full theming rules.

6. **Sentence case always, two font weights only (400, 500).** Don't introduce 600 or 700 weights. Don't use Title Case or ALL CAPS (except in uppercase-transformed labels with letter-spacing).

## Architecture rules

### `apps/app` (the stub app — hosts marketing too)

- **Framework**: Next.js App Router, deployed to Cloudflare Workers via `@opennextjs/cloudflare`. Not vanilla Next.js on Vercel. Not Pages.
- **Cloudflare bindings**: D1 (`DB`), KV (`SESSIONS`, `RATE_LIMIT`), R2 (`BACKUPS`), Turnstile. Configured in `wrangler.toml`, typed in `cloudflare-env.d.ts`. Access via `getCloudflareContext()` from the adapter, not via hardcoded env vars.
- **Auth**: single-tenant. One env var `OWNER_EMAIL` gates all write access. The magic-link endpoint compares the submitted email to `OWNER_EMAIL` before doing *anything* — no token mint, no email send, no writes on mismatch. Response is identical in both cases so the endpoint can't be used to enumerate who the owner is. `SimpleWebAuthn` (`@simplewebauthn/server` and `@simplewebauthn/browser`) handles the passkey flow once a magic-link session is established.
- **Storage model**: D1 for durable data (links, notes, users, passkeys, magic_tokens, audit). KV for short-lived state (sessions, rate-limit counters). R2 for nightly JSONL backups. Never flip these — KV is not a database.
- **Encryption**: secret notes are encrypted **client-side** with WebCrypto (AES-GCM). The server sees only ciphertext. The decryption key is in the URL fragment (`#k=...`) and never hits the server.
- **Marketing routes**: `app/stub/*` renders the public marketing pages. They use `@gordonbeeming/design-system` components only. No data fetching, no auth — static render.

### Deployment

- Single `wrangler deploy` from `apps/app`. One Worker, one domain.
- The `cloudflare-xylem-worker` sibling repo proxies `gordonbeeming.com/stub` to this Worker. The middleware in this app 301s `stub.gordonbeeming.com/stub*` to `gordonbeeming.com/stub*` so there's one canonical URL.
- `pnpm build` at the root builds packages first, then the app, via the Turborepo pipeline.

## Signing in during local dev

Dev has no real email delivery. `RESEND_API_KEY=re_dev_fake` in `.dev.vars` short-circuits `sendMagicLink`, which then `console.log`s the magic-link URL to the dev server stdout. To sign in as the owner and see the dashboard:

1. Read `OWNER_EMAIL` from `apps/app/wrangler.toml`. That's the exact string to paste into the login form. Any other email silently returns the same generic 200 response (anti-enumeration), so you'll never see a magic link logged.
2. Start the dev server with its stdout captured to a file, e.g. `cd apps/app && nohup pnpm dev > /tmp/stub-dev.log 2>&1 &`.
3. Submit the login form with that email. Turnstile must complete before the submit button enables.
4. Grab the link from the log: `grep -A1 "magic link for" /tmp/stub-dev.log | tail -2`. The URL looks like `http://localhost:5173/api/auth/magic/callback?t=<token>`. It expires in 10 minutes and can only be consumed once.
5. Navigate to that URL. You'll land on `/enroll` (first time) or `/dashboard` (if a passkey is already registered). "skip for now" on `/enroll` works fine for visual or behavioural testing.

The D1 table `magic_tokens` only stores the token's sha256 hash, so there's no way to recover a valid URL from the database. The server log is the only source.

## Workflow rules

1. **Run `pnpm install` from the root**, never inside a package.
2. **Add dependencies with `pnpm add <pkg> --filter <workspace>`**, never by editing `package.json` by hand.
3. **Keep the design-system package free of app-specific logic.** It's pure UI + tokens. No data fetching, no Cloudflare imports, no Next.js imports.
4. **React is a peer dependency of the design system.** Don't bundle React into the design-system build.
5. **Run `pnpm typecheck` and `pnpm lint` before claiming a task is done.**

## What to do when in doubt

- Prefer asking the user over guessing. This is a solo project with specific tastes — wrong guesses cost more than a clarifying question.
- If the user's request conflicts with `DESIGN.md`, surface the conflict and ask which wins. Don't silently bend the spec.
- If the user wants to skip a rule here "just for this one thing," do it — but mention that the rule exists and suggest we update `CLAUDE.md` if it's a permanent change.
