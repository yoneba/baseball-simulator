# AGENTS.md

## Package manager and runtime: Bun only

This project uses [Bun](https://bun.sh) as both the package manager and the JavaScript runtime. Do **not** use npm, npx, pnpm, yarn, or `node`.

| Instead of                        | Use                         |
| --------------------------------- | --------------------------- |
| `npm install` / `pnpm i` / `yarn` | `bun install`               |
| `npm install <pkg>`               | `bun add <pkg>`             |
| `npm install -D <pkg>`            | `bun add -d <pkg>`          |
| `npm uninstall <pkg>`             | `bun remove <pkg>`          |
| `npm run <script>`                | `bun run <script>`          |
| `npx <cmd>`                       | `bunx <cmd>`                |
| `node <file>`                     | `bun <file>`                |
| `ts-node` / `tsx <file>.ts`       | `bun <file>.ts`             |
| `npm test` / `jest` / `vitest`    | `bun test`                  |

Rules:

- `bun.lock` is the only lockfile. Never create or commit `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`.
- The `preinstall` script in `package.json` fails any install not run by Bun. Don't remove or work around it.
- Scripts run Node-based CLIs (Vite, tsc) under Bun's runtime with `bun --bun`. Follow the same pattern when adding scripts.

## Common commands

```sh
bun install          # install dependencies
bun run dev          # start the Vite dev server
bun run build        # type-check and build
bun run lint         # lint with oxlint
bun run preview      # build and preview locally
bun run deploy       # build and deploy to Cloudflare Workers
bun run cf-typegen   # regenerate worker-configuration.d.ts
```
