# 🌍 World of Cards

World of Cards is an ambitious open-source project aiming to become the largest collection of traditional card games from around the world.

Rather than building individual card game apps, the goal is to create a reusable platform where every game shares a common engine while implementing only its own rules.

---

## Getting Started on Windows

### Prerequisites

- **Git for Windows** — [git-scm.com/download/win](https://git-scm.com/download/win)
- **Node.js** — `react-native@0.86` requires `^22.13.0`, `^24.3.0`, or `>=25.0.0`. Install via [nvm-windows](https://github.com/coreybutler/nvm-windows) so you can switch versions easily, then run `nvm install 22.13.0 && nvm use 22.13.0` (or a newer LTS).
- **Expo Go** app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)) — the fastest way to run the app without installing Android Studio or Xcode.

### Setup

```powershell
git clone https://github.com/<your-org>/world-of-cards.git
cd world-of-cards
npm install
npm run mobile
```

This starts the Expo dev server for `apps/mobile`. Scan the printed QR code with Expo Go (same Wi-Fi network as your PC) to run the app on your phone, or press `w` in the terminal to open it in a browser.

### Windows-specific notes

- **Long paths**: this is an npm-workspaces monorepo, so `node_modules` nesting can exceed Windows' default 260-character path limit. Enable long path support once, as Administrator:
  ```powershell
  git config --system core.longpaths true
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -PropertyType DWord -Value 1 -Force
  ```
- **Antivirus/Defender**: real-time scanning can noticeably slow down `npm install` and Metro's file watching. Consider excluding the repo folder in Windows Security if installs feel sluggish.
- **Terminal**: PowerShell or Git Bash both work fine for the commands in this repo. If a command block above shows `bash`/POSIX syntax elsewhere in the docs, translate `&&` to `;` and env vars (`FOO=bar cmd`) to `$env:FOO='bar'; cmd` in PowerShell.
- **Watchman is not needed** — Metro's built-in file watcher works fine on Windows without it.
- Run `npm test` from the repo root at any time to run the full Jest suite (engine + mobile) as a sanity check that setup worked.

---

## Vision

Build a production-quality, cross-platform mobile application that includes classic card games from many countries in a single experience.

Examples include:

- Pişti
- Batak
- Klondike Solitaire
- Spider Solitaire
- FreeCell
- Hearts
- Spades
- Gin Rummy
- Crazy Eights
- Blackjack
- Texas Hold'em
- ...and many more.

The project is designed to scale beyond **100+ card games**.

---

## Core Principles

- Offline-first
- Modular architecture
- Shared Card Engine
- Shared Rule Engine
- Shared AI interfaces
- Feature-based architecture
- Clean Architecture
- SOLID principles
- High test coverage
- Long-term maintainability

---

## Tech Stack

- React Native
- Expo
- TypeScript
- Zustand
- React Navigation
- React Native Reanimated
- React Native SVG

---

## Roadmap

### Phase 1
- Shared Card Engine
- Shared Rule Engine
- AI abstraction
- Statistics
- Local persistence
- Pişti
- Solitaire
- Spider Solitaire
- FreeCell
- Hearts
- Spades

### Phase 2
- More card games
- Improved AI
- Themes
- Achievements

### Phase 3
- Online multiplayer
- Friends
- Matchmaking
- Rankings
- Cloud synchronization

---

## Contributing

Contributions are welcome.

Please discuss significant architectural changes before implementing them.

The project values maintainability over rapid feature development.

---

## Long-Term Goal

Create the definitive platform for discovering and playing traditional card games from every culture, with a scalable architecture capable of supporting hundreds of games over time.
