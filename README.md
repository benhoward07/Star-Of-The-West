# Star of the West

A QR-code learning game about the Star of the West Monument at The Citadel. Players visit locations, scan QR codes, listen to narration, answer quiz questions, earn medals and rise through seven ranks from Recruit to Colonel.

Built as a plain web app (TypeScript + Vite) so it opens in iPhone Safari with no app install.

## Status

Initial project structure. The game itself is being built next.

## Project layout

```
index.html                    app shell
src/index.ts                  entry point
src/GameState.ts              topics, quizzes, medals, score, ranks
src/ScreenManager.ts          screen switching
src/components/               one file per screen
src/services/                 audio, saving, QR links, sharing
public/audio/                 optional narration MP3s
public/images/                artwork and photos
tests/                        unit tests
.github/workflows/deploy.yml  GitHub Pages deployment
```

## Commands

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

The original design notes are in [GAME_SETUP_GUIDE.md](GAME_SETUP_GUIDE.md).
