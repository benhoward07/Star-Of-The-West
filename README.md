# Star of the West

A QR-code learning game about the Star of the West Monument at The Citadel. Players visit three stations, scan a QR code at each, listen to the story, answer a timed quiz, earn medals and rise through seven ranks from Recruit to Colonel.

It is a plain web app (TypeScript + Vite), so it opens in iPhone Safari with no app to install.

**Play it:** https://benhoward07.github.io/Star-Of-The-West/

**Printable QR codes:** https://benhoward07.github.io/Star-Of-The-West/?print=1

## How the game works

1. **Title screen** - welcome and instructions.
2. **Choose a topic** - scan a station's QR code or tap a topic card.
3. **Narration** - the story is read aloud, with the words on screen.
4. **Quiz** - three multiple choice questions, 20 seconds each, instant feedback.
5. **Medal** - an animated medal, a points breakdown, and a promotion when you rank up.
6. **Results** - final rank, score and medals, with Share and Play Again.

Progress is saved on the phone, so closing Safari does not lose it.

### Scoring

| What | Points |
|---|---|
| Finish a topic | 10 x the topic's difficulty |
| Each correct answer | +5 |
| Correct within 10 seconds | +2 speed bonus |

Replaying a finished topic is practice only and earns nothing extra.

### Ranks

A rank needs both its points and its medals.

| Rank | Points | Medals |
|---|---|---|
| Recruit | 0 | 0 |
| Cadet | 10 | 0 |
| Corporal | 20 | 1 |
| Sergeant | 30 | 2 |
| Lieutenant | 40 | 2 |
| Captain | 50 | 3 |
| Colonel | 60 | 3 |

The three topics are worth 10 + 10 + 20 = 40 points, so reaching Colonel also takes correct quiz answers.

## Playing on an iPhone

### Anywhere: the public link

Every push to the `main` branch is published to GitHub Pages automatically. Open the link above on any phone, or scan the "Start here" code from the printed sheet.

### At home: the local server

1. Double-click **Start Game Server.bat** (or run `npm run dev`).
2. A QR code appears in the window. Scan it with the iPhone camera.
3. The phone warns that the connection is not private, because the local server uses a self-made test certificate. Tap **Show Details**, then **visit this website**.

The phone and this PC must be on the same Wi-Fi network. If Windows Firewall asks, allow Node.js on private networks. Some campus and guest networks block phone-to-PC connections; use the public link there.

### Station QR codes

Open the game and tap **Print QR codes** on the topic screen (or add `?print=1` to the game's address). The page shows one "Start here" code and one code per station. Print it **from the public link** so the codes work on any network, then post one code at each station.

Scanning a station code with the normal iPhone camera opens the game on that topic. The **Scan Station QR Code** button inside the game reads the same codes.

## Changing the game

Everything a player reads lives in [src/GameState.ts](src/GameState.ts).

**Topics and quiz questions**

```typescript
{
  id: 'topic1',
  title: 'Your Topic Title',
  description: 'Shown on the topic card',
  audioFile: 'audio/topic1.mp3',
  narration: 'The story, read aloud and shown on screen.',
  location: 'Station 1',
  image: 'images/ship.svg',
  difficulty: 1, // 1-5: finishing the topic is worth 10 x this
  medalId: 'medal1',
  completed: false,
  quizQuestions: [
    {
      id: 't1q1',
      question: 'Your question text?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 0, // 0-3
      explanation: 'Optional fact shown after answering.',
    },
  ],
}
```

To add a station, add a topic and a medal with matching `medalId`, then print the QR sheet again.

**Medals** - the `medals` list in the same file (name, description, ribbon colors).

**Ranks and scoring** - `RANKS`, `POINTS_PER_DIFFICULTY`, `QUIZ_BONUS`, `SPEED_BONUS`, `QUESTION_TIME_SECONDS` and `FAST_ANSWER_SECONDS` at the top of the same file.

**Recorded narration** - drop `topic1.mp3`, `topic2.mp3` and `topic3.mp3` into [public/audio](public/audio). When a file is there the game plays it; otherwise the phone's built-in voice reads the narration text.

**Photos** - put images in [public/images](public/images) and set a topic's `image`, or set `locationImage` in [src/index.ts](src/index.ts) to show a campus photo above the topic list. The built-in pictures are original illustrations, not photographs.

**Colors** - the variables at the top of [src/styles.css](src/styles.css).

**Title screen text** - [src/components/TitleScreen.ts](src/components/TitleScreen.ts).

## Project layout

```
index.html                    app shell
src/index.ts                  start-up and screen wiring
src/GameState.ts              topics, quizzes, medals, score, ranks
src/ScreenManager.ts          shows one screen at a time
src/components/               one file per screen (title, topics, narration,
                              quiz, medal, conclusion, scanner, print sheet)
src/services/                 narration audio, saving, QR links, sharing
src/art.ts                    medal, rank insignia and emblem drawings
src/styles.css                theme and layout
public/audio/                 optional narration MP3s
public/images/                illustrations and icons
tests/                        unit tests
.github/workflows/deploy.yml  build, test and publish to GitHub Pages
```

## Commands

Install once:

```bash
npm install
```

Local server with a QR code for phones:

```bash
npm run dev
```

Run the tests:

```bash
npm test
```

Build the published version into `dist/`:

```bash
npm run build
```

## Historical sources

The narration and quiz facts were checked against:

- [Star of the West Monument, The Citadel](https://www.citadel.edu/our-campus/star-of-the-west-monument/)
- [The Citadel Today: Star of the West competition](https://today.citadel.edu/cadet-wins-2026-star-of-the-west-competition/)
- [Star of the West, Wikipedia](https://en.wikipedia.org/wiki/Star_of_the_West)
- [10 Facts: Charleston in the Civil War, American Battlefield Trust](https://www.battlefields.org/learn/articles/10-facts-charleston-civil-war)

The original design notes for the game are in [GAME_SETUP_GUIDE.md](GAME_SETUP_GUIDE.md). They were written for a different tool (Mattercraft); this README describes how the game actually works now.
