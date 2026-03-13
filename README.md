# TotalMix UFX Control for Stream Deck +

[![Build](https://github.com/Fikarn/StreamDeckxRME/actions/workflows/build.yml/badge.svg)](https://github.com/Fikarn/StreamDeckxRME/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An Elgato Stream Deck + plugin for controlling an RME audio interface via [TotalMix FX](https://www.rme-audio.de/totalmix-fx.html) OSC. Built for the Fireface UFX III but works with any RME interface that supports TotalMix FX OSC control.

## Features

- **Preamp Gain** (encoder) — adjust input gain with 1 dB per tick, LCD shows channel name and current dB value
- **Volume Control** (encoder) — control fader volume on any bus (input / playback / output), LCD shows label and dB value
- **Phantom Power** (keypad) — toggle 48V phantom power per input channel, button state reflects on/off
- **Mute Toggle** (keypad) — toggle mute on any bus/channel, button state reflects muted/unmuted
- **Connection monitoring** — automatic detection when TotalMix FX goes offline, with "OFFLINE" display and auto-recovery

All actions receive real-time feedback from TotalMix FX — changes made in the TotalMix mixer are reflected on the Stream Deck immediately.

## Requirements

- Elgato Stream Deck + (with encoders and LCD)
- Stream Deck software v6.6+
- RME audio interface with TotalMix FX
- Node.js 20+ (bundled by Stream Deck)

## Quick Start

1. **Install the plugin** — download the latest `.streamDeckPlugin` file from the [Releases page](https://github.com/Fikarn/StreamDeckxRME/releases) and double-click to install
2. **Configure TotalMix FX OSC** — see [OSC Setup](#totalmix-fx-osc-setup) below
3. **Add an action** — open Stream Deck software, find **TotalMix UFX** in the action list, drag a Gain or Volume action onto an encoder, or a Phantom/Mute action onto a key
4. **Configure the action** — click the action to open its settings and select the channel/bus
5. **Use it** — rotate encoders to adjust gain/volume, press keys to toggle phantom/mute

### Suggested Stream Deck + Layout

**Input Page** — 4 encoders for gain (AN 1–4) + 4 buttons for phantom power (AN 1–4)

**Output Page** — 3 encoders for volume (Main Out, Phones 1, Phones 2) + 3 buttons for mute toggles

## TotalMix FX OSC Setup

1. Open TotalMix FX and go to **Options > Settings > OSC**
2. Enable **OSC Control**
3. Set the following:
   | Setting | Value |
   |---|---|
   | Remote Controller Address | `127.0.0.1` |
   | Port (incoming) | `7001` |
   | Port (outgoing) | `9001` |
   | Number of faders per bank | `16` |

## Installation

### From Release (recommended)

Download the latest `.streamDeckPlugin` file from the [Releases page](https://github.com/Fikarn/StreamDeckxRME/releases) and double-click to install.

### Build from Source

```bash
git clone https://github.com/Fikarn/StreamDeckxRME.git
cd StreamDeckxRME
npm install
npm run build
npx streamdeck link com.edvinlandvik.totalmix-ufx.sdPlugin
```

Restart the Stream Deck software. The plugin actions will appear under the **TotalMix UFX** category.

## Troubleshooting

### TotalMix not responding / "OFFLINE" on Stream Deck

- Verify TotalMix FX is running and OSC is enabled (**Options > Settings > OSC**)
- Confirm ports match: TotalMix incoming = `7001`, outgoing = `9001`
- Check that "Remote Controller Address" is set to `127.0.0.1`
- On Windows, ensure your firewall isn't blocking UDP on ports 7001/9001

### Plugin not appearing in Stream Deck

- Restart the Stream Deck software
- If building from source, make sure `npm run build` completed without errors and you ran the `streamdeck link` command

### Values out of sync

- TotalMix uses a global bus selection model — the plugin's heartbeat polling refreshes state every few seconds. Wait a moment for values to sync.
- If values remain stale, restart the plugin: `npx streamdeck restart com.edvinlandvik.totalmix-ufx`

### Channel numbering confusion

- Channel numbers correspond to the order of channels within TotalMix FX, **not** the physical connector numbers on some interfaces
- AN 1–12 maps to analog input channels 1–12
- For volume/mute, channel numbers refer to the selected bus (e.g., Output channel 1 = Main Out on most RME interfaces)

## Development

```bash
npm install          # Install dependencies
npm run build        # Build plugin bundle
npm run watch        # Build with file watching
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix
```

### Useful Commands

```bash
npx streamdeck link com.edvinlandvik.totalmix-ufx.sdPlugin   # Symlink plugin for development
npx streamdeck restart com.edvinlandvik.totalmix-ufx          # Restart the plugin
```

## Project Structure

```
src/
  plugin.ts                 Entry point — registers actions, starts OSC, connects
  actions/
    gainControl.ts          Encoder action: preamp gain (input bus)
    volumeControl.ts        Encoder action: fader volume (any bus)
    phantomPower.ts         Keypad action: 48V toggle (input bus)
    muteToggle.ts           Keypad action: mute toggle (any bus)
  osc/
    totalmixClient.ts       OSC UDP sender (port 7001) with async command queue
    totalmixServer.ts       OSC UDP listener (port 9001)
    oscBridge.ts            Central state store + event bus (singleton)
    types.ts                Shared types (BusType, ChannelState, etc.)
  utils/
    converters.ts           OSC-to-dB conversion and display formatting

com.edvinlandvik.totalmix-ufx.sdPlugin/
  manifest.json             Plugin manifest
  layouts/                  LCD encoder layouts
  ui/                       Property Inspector HTML files
  imgs/                     Action and plugin icons
```

## Architecture

TotalMix FX uses a global bus selection model — you select a bus (`/1/busInput`, `/1/busPlayback`, `/1/busOutput`) and then all subsequent OSC messages apply to that bus. The plugin handles this with:

1. **Async command queue** — all OSC sends go through a serial queue that selects the correct bus before each command, preventing race conditions
2. **State tracking** — the OSC bridge tracks the currently active bus so incoming feedback messages are attributed to the correct bus/channel
3. **Heartbeat polling** — cycles through bus selections every 5 seconds to request fresh state from TotalMix
4. **Connection monitoring** — detects when TotalMix stops responding (no OSC messages within 8s) and shows "OFFLINE" on all actions, with automatic recovery when TotalMix comes back

## OSC Address Reference

| Address | Type | Range | Description |
|---|---|---|---|
| `/1/busInput` | float | 0 or 1 | Select input bus |
| `/1/busPlayback` | float | 0 or 1 | Select playback bus |
| `/1/busOutput` | float | 0 or 1 | Select output bus |
| `/1/gainN` | float | 0.0–1.0 | Preamp gain (0–65 dB) |
| `/1/phantomN` | float | 0 or 1 | Phantom power on/off |
| `/1/volumeN` | float | 0.0–1.0 | Fader volume |
| `/1/muteN` | float | 0 or 1 | Mute on/off |

*N = channel number (1-indexed within the selected bus)*

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
