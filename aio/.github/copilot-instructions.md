<!--
Guidance for AI coding agents working on the `aio` Next.js workspace.
Keep this file concise and actionable — reference concrete files and commands.
-->

# Copilot instructions for aio (Next.js + Supabase)

This repo is a small Next.js 13/14 app (app directory) that uses Supabase for auth/session handling and a minimal Python backend under `/backend` (local dev only). The goal here is to give an AI agent the most useful, immediately actionable knowledge to be productive.

Quick facts
- Run dev: `npm run dev` (uses `next dev --turbopack`). See `package.json`.
- Build: `npm run build`; Start production server: `npm run start`.
- Lint: `npm run lint`.
- Next version: listed in `package.json` (Next 15+). Tailwind + local fonts are used in `app/layout.tsx`.

Architecture & important files
- App (Next.js app dir): `app/` contains routes and React Server/Client components.
  - Root layout: `app/layout.tsx` uses local fonts and provides global CSS.
  - Landing page: `app/(root)/page.tsx` — small client component (uses `animejs`) that demonstrates client-side animation patterns.

- Supabase integration
  - Browser client helper: `utils/supabase/client.ts` (createBrowserClient wrapper).
  - Server/client SSR helper: `utils/supabase/server.ts` (createServerClient wrapper for server components; accepts a `cookies` store).
  - Middleware helper for edge-like usage: `utils/supabase/middleware.ts` (builds server client from `NextRequest`, mutates cookies on responses).
  - Legacy/simpler client: `app/components/supabase.tsx` (simple createClient from `@supabase/supabase-js`).

Patterns & conventions to follow
- Prefer the `app/` directory routing and server/client component boundaries used by Next.js 13+. Look at `utils/supabase/server.ts` for how server components obtain Supabase clients via the `cookies` store.
- When you need to modify auth/session flows, update `utils/supabase/*` first — these are the canonical integration points.
- Files under `app/auth/*` use small presentational wrappers that import `LoginForm` / `SignUpForm` from `app/components/*`; follow the pattern of thin pages delegating logic to components.
- Use Tailwind utility classes and the `cn()` helper in `lib/utils.ts` when composing classNames.

Dev workflow notes (non-obvious)
- Environment: Supabase values are read from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. If missing, the app will throw at runtime (see `app/components/supabase.tsx` and `utils/supabase/*`).
- Animations: `animejs` is used in `app/(root)/page.tsx` and imported directly in client components.
- Server components that need Supabase sessions should call `utils/supabase/server.ts` and pass Next.js cookies (see `createClient(cookieStore: ReturnType<typeof cookies>)`).

Integration & testing pointers
- There is no test harness in the repo. Rapid verification steps:
  1. Run `npm run dev` and open http://localhost:3000.
  2. Check auth pages under `/auth/login` and `/auth/sign-up`.
  3. If Supabase env vars are missing, the client helpers will throw — set them in your environment before testing.

What to avoid / gotchas
- Do not change the `createServerClient` cookie adapter shape in `utils/supabase/server.ts` unless you update all callers; the project expects `getAll()`/`setAll()` semantics.
- `utils/supabase/middleware.ts` returns a `NextResponse` and manipulates cookies via `NextResponse.cookies.set` — respect that flow when adding middleware.

Examples to copy/paste
- Create a server Supabase client inside a Server Component:

```ts
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

const supabase = createClient(cookies());
const { data } = await supabase.from('profiles').select('*');
```

Files to reference when making changes
- `package.json` — scripts & deps
- `app/layout.tsx` — fonts/global layout
- `app/(root)/page.tsx` — client component example (animejs)
- `utils/supabase/server.ts`, `utils/supabase/client.ts`, `utils/supabase/middleware.ts` — Supabase integration
- `app/auth/*` and `app/components/*` — auth flow and form components

If you need clarification
- Ask for missing env var values and whether the Python backend under `/backend` should be run in local integration tests. There is a `backend` directory but it may be a local tool rather than part of primary Next app runtime.

End of file
