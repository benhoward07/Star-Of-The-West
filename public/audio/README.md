# Narration audio

Drop recorded narration here and the game plays it instead of the phone's built-in voice:

- `topic1.mp3` - The Star of the West (the ship)
- `topic2.mp3` - The First Shot
- `topic3.mp3` - The Monument

The words to record are the `narration` text of each topic in `src/GameState.ts`.

Recording tips: 30 to 60 seconds each, clear voice, MP3 at 128 kbps or higher, normalized volume.

If a file is missing, the game reads that topic's narration aloud with text-to-speech.
