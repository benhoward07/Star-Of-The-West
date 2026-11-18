# Narration audio

`topic1.mp3`, `topic2.mp3` and `topic3.mp3` are the narration recordings the game plays. They were generated from the `narration` text in `src/GameState.ts` with the free Kokoro text-to-speech model.

`narration.json` records when each sentence starts and ends, so the game can highlight the sentence being read. It also stores a fingerprint of the text that was recorded.

## After changing a narration

Run this in the project folder to record it again:

```
npm run narration
```

The first run downloads the voice model (about 326 MB). Until you re-record, the game notices that the text no longer matches the recording and reads the new text with the phone's built-in voice instead, so players never hear words that differ from the screen.

To try another voice, set `SOTW_VOICE` first, for example `am_michael` (American male) or `bm_george` (British male).

## Using your own recordings

Replace the MP3 files with your own and delete `narration.json`. The game then plays your files without sentence highlighting.
