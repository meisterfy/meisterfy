# frontend-react

The Meisterfy frontend: a React 19 SPA (Vite, TanStack Router + Query, Tailwind v4). This is the live app — the Svelte→React migration is complete and cut over (see [`docs/adrs/001-migrate-frontend-from-svelte-to-react.md`](../docs/adrs/001-migrate-frontend-from-svelte-to-react.md)); the retired SvelteKit app has been removed.

## Scripts

| Command          | Description            |
| ---------------- | ---------------------- |
| `bun run dev`    | Dev server on :5174    |
| `bun run build`  | Production build       |
| `bun run test`   | Run tests (vitest)     |
| `bun run format` | Format code (prettier) |
