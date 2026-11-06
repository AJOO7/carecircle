# CareCircle

A web app that helps a family share the care of an ageing parent: medicine reminders the parent answers on WhatsApp, follow-ups with a named owner, tasks, appointments and records. Course prototype. See [PRODUCT.md](PRODUCT.md) for what the product is and the rules it follows.

Built with React 19, Vite 8, Tailwind CSS v4 and react-router 7. The backend is Supabase (project `ksnmbtlicmmzfwhwcicv`).

This code was moved from Figma Make on 2026-11-06. GitHub is now the source of truth; the Figma Make file is an archive.

## Run it locally

You need Node.js 22.

```bash
npx pnpm@10.34.3 install
npx pnpm@10.34.3 dev
```

Open http://localhost:8443.

Check before you open a pull request:

```bash
npx tsc --noEmit -p .
npx pnpm@10.34.3 build
```

## How to make a change

1. Make a branch. Never commit to `main` directly.
2. Make the change (by hand or with Claude Code), then run the two checks above.
3. Open a pull request. The hosting service adds a preview link to it.
4. Someone else reviews it and merges it. The live site updates after the merge.

Keep each pull request small: one change, one pull request.

## Where things are

- `src/app/routes.tsx`: all pages and their addresses
- `src/pages/`: one file per page
- `src/components/`: shared pieces of the interface
- `src/context.tsx`: app state and every action that changes it
- `src/lib/`: helpers (Supabase client, sample data, assistant, digests)
- `supabase/functions/server/`: the server code (Supabase edge function `make-server-e043d7e3`)
- `utils/supabase/info.tsx`: Supabase project ID and public key (safe to be public)

## Server code

Changes to `supabase/functions/server/` do not go live when you merge. Someone with access to the Supabase project must deploy the edge function `make-server-e043d7e3` again. Keep "verify JWT" turned on when you deploy.

Never commit secret keys. The Anthropic API key and the Supabase service key are Supabase secrets, not files in this repo.
