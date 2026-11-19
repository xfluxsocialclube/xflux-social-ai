# XFLUX Meta Auth — Cloudflare Worker

This service is an isolated authentication component for XFLUX. It does not host customer videos, captions, schedules, or media libraries.

## What it does

- Issues a unique device ID and secret for each XFLUX installation.
- Starts Meta Unified Login using the configured Facebook Login for Business `config_id`.
- Receives the OAuth callback and exchanges the authorization code on the server, where the Meta App Secret is kept.
- Encrypts the returned access token with AES-256-GCM before storing it in D1.
- Keeps each installation's Meta token in a separate database row and requires that installation's device secret for status requests.

The token is not returned to the desktop application. Publishing/API proxy endpoints are a separate next implementation step; a successful OAuth callback alone does not mean publishing is ready.

## Required Cloudflare setup

1. Create a Cloudflare account and enable Workers.
2. Create a D1 database named `xflux-meta-auth`, then apply `schema.sql`.
3. Replace the D1 database ID in `wrangler.toml`.
4. Set these Worker secrets (never commit their values):
   - `META_APP_ID`: XFLUX Meta app ID.
   - `META_APP_SECRET`: Meta App Secret.
   - `META_CONFIG_ID`: Facebook Login for Business configuration ID.
   - `META_REDIRECT_URI`: the deployed Worker callback URL ending in `/oauth/meta/callback`.
   - `TOKEN_ENCRYPTION_KEY`: base64 encoding of 32 cryptographically random bytes.
5. In Cloudflare Workers Builds, connect this repository and set **Root directory** to `cloudflare-worker` (not `/`). Set **Build command** to `npm install` and **Deploy command** to `npm run deploy`. Do not use the root application's `npm run build` for this Worker.
6. Deploy only after the D1 database ID has replaced the placeholder and the D1 schema has been applied.
7. Add the exact deployed callback URL to the Meta configuration's valid redirect URIs.

## Important

- Do not put the Meta App Secret or token encryption key in the XFLUX installer, frontend, Git repository, or public website.
- The free Workers plan currently allows up to 100,000 requests/day and 10 ms CPU time per request; D1 quotas also apply. Check current Cloudflare limits before public rollout.
- This is a first authentication foundation, not yet a production-ready publishing backend. Before enabling customer-wide use, add rate limiting, device revocation, token refresh/revocation, audit controls, and the server-side Graph API publishing endpoints.
