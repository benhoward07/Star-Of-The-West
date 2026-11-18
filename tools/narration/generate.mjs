// Generates the narration audio for every topic.
//
//   npm run narration
//
// It reads each topic's `narration` text from src/GameState.ts, speaks it with
// the free Kokoro text-to-speech model (runs on this computer, no account),
// and writes:
//
//   public/audio/topic1.mp3 ...   the recordings
//   public/audio/narration.json   when each sentence starts and ends, so the
//                                 game can highlight the sentence being read
//
// Run it again whenever you change a narration. Until you do, the game notices
// the text no longer matches the recording and uses the phone's voice instead.
//
// Options (environment variables):
//   SOTW_VOICE   Kokoro voice id (default af_heart). Others: af_bella,
//                am_michael, am_fenrir, bm_george, bf_emma ...
//   SOTW_SPEED   speaking speed, 1 = normal (default 0.95)

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { KokoroTTS } from 'kokoro-js';
import { Mp3Encoder } from '@breezystack/lamejs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const outDir = join(root, 'public', 'audio');

const VOICE = process.env.SOTW_VOICE || 'af_heart';
const SPEED = Number(process.env.SOTW_SPEED || 0.95);
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const BITRATE_KBPS = 96;
const LEAD_IN_SECONDS = 0.3;
const GAP_SECONDS = 0.38;
const TAIL_SECONDS = 0.5;

// ---- Read the game's own content (TypeScript) -----------------------------

async function loadGameContent() {
  const result = await build({
    stdin: {
      contents:
        "export { GameState } from './src/GameState.ts';\n" +
        "export { splitSentences, narrationHash } from './src/services/AudioManager.ts';\n",
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  const file = join(here, '.game-content.mjs');
  writeFileSync(file, result.outputFiles[0].text);
  try {
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(file, { force: true });
  }
}

// ---- Audio helpers ---------------------------------------------------------

function toMp3(samples, sampleRate) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = Math.round(s * 32767);
  }
  const encoder = new Mp3Encoder(1, sampleRate, BITRATE_KBPS);
  const parts = [];
  const block = 1152;
  for (let i = 0; i < pcm.length; i += block) {
    const chunk = encoder.encodeBuffer(pcm.subarray(i, i + block));
    if (chunk.length > 0) parts.push(Buffer.from(chunk));
  }
  const tail = encoder.flush();
  if (tail.length > 0) parts.push(Buffer.from(tail));
  return Buffer.concat(parts);
}

/** Loudest sample, used to bring every recording to the same level. */
function peak(samples) {
  let max = 0;
  for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
  return max;
}

const round = (seconds) => Math.round(seconds * 100) / 100;

// ---- Main ------------------------------------------------------------------

const { GameState, splitSentences, narrationHash } = await loadGameContent();
const topics = new GameState().topics.value;

console.log(`Loading the Kokoro voice model (first run downloads about 326 MB)...`);
const tts = await KokoroTTS.from_pretrained(MODEL, { dtype: 'fp32', device: 'cpu' });
console.log(`Voice: ${VOICE}, speed: ${SPEED}\n`);

mkdirSync(outDir, { recursive: true });
const manifest = {
  generator: 'Kokoro-82M v1.0 via kokoro-js (Apache-2.0)',
  voice: VOICE,
  speed: SPEED,
  files: {},
};

for (const topic of topics) {
  const sentences = splitSentences(topic.narration);
  const clips = [];
  let sampleRate = 24000;

  for (const [index, sentence] of sentences.entries()) {
    const audio = await tts.generate(sentence, { voice: VOICE, speed: SPEED });
    sampleRate = audio.sampling_rate;
    clips.push(audio.audio);
    console.log(`  ${topic.id} ${index + 1}/${sentences.length}  ${(audio.audio.length / sampleRate).toFixed(1)}s  ${sentence.slice(0, 60)}`);
  }

  const gap = Math.round(GAP_SECONDS * sampleRate);
  const lead = Math.round(LEAD_IN_SECONDS * sampleRate);
  const tail = Math.round(TAIL_SECONDS * sampleRate);
  const total = lead + clips.reduce((sum, clip) => sum + clip.length, 0) + gap * (clips.length - 1) + tail;

  const track = new Float32Array(total);
  const timings = [];
  let offset = lead;
  for (const clip of clips) {
    track.set(clip, offset);
    timings.push([round(offset / sampleRate), round((offset + clip.length) / sampleRate)]);
    offset += clip.length + gap;
  }

  // Normalize to a consistent, comfortable level.
  const level = peak(track);
  if (level > 0) {
    const gain = 0.89 / level;
    for (let i = 0; i < track.length; i++) track[i] *= gain;
  }

  const fileName = topic.audioFile.split('/').pop();
  const mp3 = toMp3(track, sampleRate);
  writeFileSync(join(outDir, fileName), mp3);

  const seconds = total / sampleRate;
  const words = topic.narration.split(/\s+/).length;
  manifest.files[topic.audioFile] = {
    hash: narrationHash(topic.narration),
    duration: round(seconds),
    sentences: timings,
  };
  console.log(`${topic.id}: ${fileName}  ${seconds.toFixed(1)}s  ${(mp3.length / 1024).toFixed(0)} KB  ${Math.round(words / (seconds / 60))} words/min\n`);
}

writeFileSync(join(outDir, 'narration.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Wrote public/audio/narration.json');
