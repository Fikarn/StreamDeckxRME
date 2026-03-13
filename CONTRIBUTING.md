# Contributing

Contributions are welcome! Please follow these guidelines.

## Before You Start

- Open an issue to discuss significant changes before submitting a PR
- For bug fixes, include steps to reproduce

## Development Setup

1. Prerequisites: Node.js v20+, Elgato Stream Deck software v6.6+
2. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/Fikarn/StreamDeckxRME.git
   cd StreamDeckxRME
   npm install
   ```
3. Build and link for development:
   ```bash
   npm run build
   streamdeck link com.edvinlandvik.totalmix-ufx.sdPlugin
   ```
4. Use `npm run watch` during development for automatic rebuilds

## Code Quality

- Write TypeScript — no plain JavaScript
- Run `npm run lint:fix` before committing
- Keep code simple and focused

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add EQ control action
fix: correct volume dB display at low values
docs: update OSC address reference table
refactor: extract bus selection into shared helper
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `npm run build` and `npm run lint` pass
4. Push and open a PR with a clear description of what changed and why
5. Link any related issues

## Adding a New Action

The architecture is designed for easy extension:

1. Create a new action class in `src/actions/` extending `SingletonAction`
2. Add the `@action` decorator with a unique UUID
3. Use `oscBridge` for all OSC communication
4. Register the action in `src/plugin.ts`
5. Add the action to `manifest.json`
6. Create a Property Inspector HTML file in `com.edvinlandvik.totalmix-ufx.sdPlugin/ui/`
7. Add an LCD layout JSON if the action uses an encoder
