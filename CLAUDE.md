# Project: TotalMix UFX Control for Stream Deck +

Elgato Stream Deck + plugin controlling RME audio interfaces via TotalMix FX OSC.
Repo: https://github.com/Fikarn/StreamDeckxRME

## Tech Stack
- TypeScript, Rollup bundler, `@elgato/streamdeck` v2 SDK (TC39 decorators, NOT legacy `experimentalDecorators`), `node-osc`
- ESLint (typescript-eslint flat config), Prettier, EditorConfig
- GitHub Actions CI (lint + build on push/PR)
- Plugin UUID: `com.edvinlandvik.totalmix-ufx`

## Commands
- `npm run build` — rollup bundle → `com.edvinlandvik.totalmix-ufx.sdPlugin/bin/plugin.js`
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` — Prettier
- `npm run watch` — dev mode with file watching
- `streamdeck link com.edvinlandvik.totalmix-ufx.sdPlugin` — symlink for dev
- `streamdeck restart com.edvinlandvik.totalmix-ufx` — restart plugin

## Architecture

### OSC Model (critical to understand)
TotalMix has **global bus selection** — you send `/1/busInput`, `/1/busPlayback`, or `/1/busOutput`, then all subsequent `/1/volumeN`, `/1/gainN`, etc. apply to that bus. Feedback messages also use the last-selected bus as context.

### Key Components
- **`src/osc/oscBridge.ts`** — Singleton. Central state store (`Map<"bus:channel", ChannelState>`), tracks active bus, parses incoming OSC, emits typed events (`gainChanged`, `volumeChanged`, `phantomChanged`, `muteChanged`). Heartbeat every 5s cycles through buses for state refresh.
- **`src/osc/totalmixClient.ts`** — OSC UDP sender (port 7001). **Async command queue** serializes all sends to avoid bus selection race conditions. Every command selects its bus first.
- **`src/osc/totalmixServer.ts`** — OSC UDP listener (port 9001). EventEmitter, handles messages + bundles.
- **`src/actions/`** — 4 actions, each subscribes to oscBridge events in `onWillAppear`, cleans up in `onWillDisappear`:
  - `gainControl.ts` — Encoder, input bus, 1 dB/tick
  - `volumeControl.ts` — Encoder, any bus, configurable label
  - `phantomPower.ts` — Keypad, input bus, 2-state toggle
  - `muteToggle.ts` — Keypad, any bus, 2-state toggle
- **`src/utils/converters.ts`** — OSC↔dB conversions. Gain is linear (0–65 dB). Volume uses nonlinear curve (0.82≈0dB, 1.0=+6dB).

### Gotchas
- `setFeedback` only exists on `DialAction`, not `KeyAction` — must narrow with `"setFeedback" in action`
- `setState` only exists on `KeyAction` — same narrowing needed
- `node-osc` `Client.send()` requires a `Message` object, not raw args
- `tsconfig.json` `outDir` must be inside the rollup output directory
- Property Inspector HTML files use `sdpi-components` web components from Elgato CDN

## Adding a New Action
1. New file in `src/actions/` extending `SingletonAction` with `@action` decorator
2. Use `oscBridge` for OSC I/O
3. Register in `src/plugin.ts`
4. Add to `manifest.json` (action entry with UUID, Controllers, States/Encoder layout)
5. Create PI HTML in `sdPlugin/ui/`
6. Create layout JSON in `sdPlugin/layouts/` if encoder
