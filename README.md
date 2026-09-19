# ChatGPT · Private Azure client

A private, mobile-first PWA for Azure OpenAI. A familiar chat interface with individual passkeys, invitation-only access, model selection, streaming replies, attachments, and synchronized conversations.

This is an independent application, not an official ChatGPT client. It does not reproduce all ChatGPT services.

## What it does

- Installable on iPhone, Android, and desktop; light, dark, and system appearance.
- Mobile composer follows the visible keyboard viewport, keeps focus when sending, and allows a new draft during streaming. Return inserts a new line on touch devices; desktop Enter sends without interrupting IME composition.
- Mobile action sheets for models, attachments, and chat options; swipe-down keyboard dismissal, dismissible sheet handles, 44 px controls, and conversation scrolling that preserves your reading position.
- Owner-issued, single-use invitations. No public signup and no shared password.
- Discoverable passkeys with required device verification, backed by SimpleWebAuthn.
- Separate histories for each account, with search, rename, pin, delete, export, edit, regenerate, and stop. History-row menus organize conversations without opening them.
- Create and rename folders, move conversations, and filter by folder or Unfiled. Deleting a folder keeps its conversations. Up to 50 folders per account.
- Opt-in memory with separate recall/generation controls, source evidence, and manual add/edit/delete in Settings → Memory. `/memories` opens controls; temporary chats never use or generate memories. See [memory design](docs/memory-design.md) for Codex references, eligibility, limits, and deliberate differences.
- Allowlisted Azure deployments and configurable thinking effort.
- Built-in Responses API web search: automatic when useful, or explicitly selected from the attachment menu. Live search activity, clickable inline citations, and saved source lists. Your Azure deployments must support the `web_search` tool.
- English and Turkish interface, selected in Settings and saved to the account across devices. The preferred language also guides text and voice replies.
- Paste clipboard images into the composer, use **Paste image** from the attachment menu, or drop photos/files onto the chat on desktop. Pending images show private thumbnails; large images are resized before upload. Clipboard access depends on browser support and permission.
- **Take photo** in the attachment menu opens native camera capture on supported phones (rear camera preferred). Photos are oriented by the browser, resized to a maximum 2,048 px edge, and encoded as JPEG within the upload limit. Desktop browsers may show an image picker instead.
- PDF, JPEG, PNG, WebP, and UTF-8 text/code uploads: 3 MB per file, four per message, 12 MB per conversation context.
- Optional Azure realtime voice over WebRTC, plus device text-to-speech for reading replies.
- Temporary text chats that are not written to application history.
- Owner controls for invitations, revocation, and recovery; account session management.

## Run locally

Use Node.js 22 or later and an Azure StorageV2 account with public blob access disabled.

```sh
npm ci
cp .env.example .env.local
# Fill the server settings in .env.local using your secret manager.
npm run dev
```

`APP_ORIGIN` must exactly match the browser origin, with no trailing slash. Passkeys bind to the hostname: credentials registered on localhost will not work on another hostname. Production requires HTTPS. Settle your permanent hostname before enrolling people.

The model list uses **Azure deployment names**, not an assumed catalog of available models. Verify that each selected deployment supports the Responses API and any modalities you expose. Realtime voice requires its own compatible Azure deployment.

### First owner

Run once with the correct origin and credentials in `.env.local`:

```sh
OWNER_NAME=Owner BOOTSTRAP_OUTPUT=/path/outside/repository/owner-invitation.txt npm run bootstrap
```

This creates the private table/container and a seven-day, single-use owner invitation. A durable bootstrap marker prevents rerunning it to create another owner. Open the private output link on the owner’s device and save a passkey. Never commit, publish, or log invitation links.

After signing in, use **Settings → Family** to invite a person. Family invitations expire in 24 hours and can be canceled before use. Only the owner can issue them; owner controls require a passkey sign-in within the preceding 15 minutes. A synced passkey can unlock on another device in the same password-manager ecosystem. Otherwise add a passkey or use owner-assisted recovery.

### Recovery

The owner can create a member recovery invitation under **Settings → Family**. Redeeming a recovery invitation replaces previous passkeys and invalidates existing sessions.

If the owner loses all passkeys, a trusted infrastructure operator can run:

```sh
BOOTSTRAP_OUTPUT=/path/outside/repository/recovery.txt npx tsx --env-file=.env.local scripts/recover-owner.ts
```

This requires server secrets and is deliberately unavailable as a public HTTP action. It does not bypass device verification. Back up the encryption key in a secure password manager; losing it makes existing stored data unreadable. Do not replace it casually.

## Deploy

Create a Vercel project and configure the server variables as sensitive production environment variables. Deploy with the authenticated Vercel CLI. No GitHub integration is required. If your deployment address is private, do not enable public deployment checks, badges, repository homepage links, screenshots with the address, or GitHub deployment records.

The repository’s daily Vercel cron calls `/api/maintenance`, protected by `CRON_SECRET`. It removes expired sessions, challenges, invitations, expired counters, and orphan uploads older than 24 hours, then runs bounded memory work. Authenticated app loads also schedule eligible memory work. Set the function duration to at least 240 seconds (configured in the route). Verify streaming and WebRTC behavior on the actual hosting plan and network.

## Data and security design

- Azure model keys and the storage credential are read only in server modules. The browser receives neither long-lived Azure keys nor voice ephemeral tokens.
- Conversation bodies, attachment bytes, and table payloads use AES-256-GCM with fresh nonces and resource-bound authenticated data. Azure Storage also encrypts at rest. This is **not end-to-end encryption**: the app server and Azure inference service process plaintext to provide the service.
- Opaque 256-bit session tokens are hashed before lookup. Production cookies use `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`, and a rolling one-year expiry. Valid sessions renew at most once every 24 hours of activity; existing 30-day sessions upgrade on their next request. Renewal preserves the original passkey-verification time, so privileged actions still require recent verification. Expired or revoked sessions cannot be renewed. At most 20 recent sessions are retained under ordinary sequential sign-ins.
- Every private route authenticates the current account; resource paths are derived from its server-side identity. Disabling an account is checked on every authenticated request. An already-started inference/voice connection may continue until it ends.
- Mutations enforce the configured origin; WebAuthn validates origin, RP ID, challenge, signature, and required user verification. Invitations are consumed in the same atomic transaction that enrolls the account/key.
- Model input and uploaded filenames are untrusted. Only validated file formats are accepted. Downloads are attachments, not executable web content. Markdown does not execute raw HTML or load remote tracking images.
- CSP uses per-request nonces. Private documents and APIs use `no-store`; the service worker caches only a generic offline page, manifest, and icons. No chat or session token is kept in browser localStorage.
- Shared, durable rate limits: 150 text requests per account per UTC day, 12 per minute, 30 uploads per hour, 10 voice starts per UTC day. Output is capped at 8,192 tokens and up to six built-in tool calls per text request. Web searches incur provider tool charges. Authentication attempts and invitation creation also have limits.

## Practical limits

- Voice sessions are separate from text chats and are not saved. The app ends voice after ten minutes; this is a client timer, not a provider billing ceiling. A signed-in user can modify their client. Use Azure quotas and billing alerts for a hard operational spending boundary.
- Revocation prevents new requests; it cannot retract data already viewed or immediately terminate an established peer-to-peer voice connection.
- There is no code execution sandbox or image generation. Account memory is implemented using the documented Codex pattern, with different storage, scheduling, retrieval, and budgets. This app uses Azure Responses with built-in web search, not the managed Codex harness. The OpenAI Agents API is a separate integration with its own authentication and environment requirements; identical ChatGPT/Codex capabilities or latency are not promised. Word/Excel/PowerPoint attachments are not accepted; export them to PDF or CSV/text first.
- PDF/image support depends on the configured Azure model. Azure service retention, abuse monitoring, and regional processing remain subject to your Azure configuration; `store:false` does not imply zero provider retention.
- This remains a web app, not a UIKit application. The operating system controls keyboard animation, dictation, selection, and native pickers. Home Screen mode removes browser chrome; a physical device check is needed to assess those platform interactions.
- The app needs connectivity for chat. It is not an offline inference client. Device passkeys, microphone permissions, audio autoplay, and Home Screen installation need a real-device check on your target iOS/Android version.
- A deployment URL is an address, not a secret or an access control. HTTPS certificates and infrastructure metadata may make a hostname discoverable even if you keep it out of this repository.

## Validate

```sh
npm run check
npm run build
npm audit --audit-level=high
```

The unit suite covers authenticated encryption, token generation, session renewal, and citation URL/range handling. Before a production release, also run real-browser passkey enrollment/login/replay checks, a two-account authorization and revocation test, live Azure text and attachment requests, secure-cookie and CSP inspection, mobile/desktop rendering, and voice negotiation. Use disposable identities and delete test data after verification. Test fixtures, production secrets, activation links, deployment addresses, and private QA outputs do not belong in the repository.

## Branding assets

The ChatGPT/OpenAI knot mark is reproduced for the personal client interface. It is not covered by this repository’s MIT license, and no endorsement by OpenAI is implied. SVG geometry source: [Lobe Icons](https://github.com/lobehub/lobe-icons/blob/master/packages/static-svg/icons/openai.svg).
