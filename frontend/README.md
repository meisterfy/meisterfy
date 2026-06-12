# frontend-react

React rewrite of the Meisterfy frontend (migration in progress; see [`docs/adrs/001-migrate-frontend-from-svelte-to-react.md`](../docs/adrs/001-migrate-frontend-from-svelte-to-react.md)). The legacy SvelteKit app remains in `../frontend` until cutover.

## Scripts

| Command          | Description            |
| ---------------- | ---------------------- |
| `bun run dev`    | Dev server on :5174    |
| `bun run build`  | Production build       |
| `bun run test`   | Run tests (vitest)     |
| `bun run format` | Format code (prettier) |
