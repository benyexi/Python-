# Python Executor

A Manus-generated Python executor web application. The project is now stored as normal source files instead of a single uploaded zip archive, so GitHub can show, search, diff, and version the code properly.

## Project Structure

- `client/` - React/Vite frontend.
- `server/` - Express/tRPC backend and Python execution route.
- `shared/` - Shared TypeScript types/constants.
- `drizzle/` - Database schema and migration metadata.
- `references/` - Project reference notes.

## Requirements

- Node.js 20 or newer
- pnpm 10.x

## Install

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

By default the app runs on port `3000` unless `PORT` is set.

## Build and Run

```bash
pnpm build
pnpm start
```

## Useful Commands

```bash
pnpm check
pnpm test
pnpm format
```

## Optional Environment Variables

Some generated Manus services are optional and only needed for specific features:

- `DATABASE_URL` - Database connection string for Drizzle.
- `OPENAI_API_KEY` - Enables LLM-backed features in `server/_core/llm.ts`.
- `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` - Enable Manus/Forge proxy services such as maps, storage, image generation, heartbeat, and voice transcription.
- `VITE_FRONTEND_FORGE_API_KEY` - Frontend key used by the map component.
- `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID` - Optional authentication/runtime integration values.

The app can still be inspected and developed without these values, but features that call those services will report a configuration error until the corresponding variables are set.
