import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GameState,
  POINTS_PER_DIFFICULTY,
  QUIZ_BONUS,
  RANKS,
  SPEED_BONUS,
  type AnswerResult,
} from '../src/GameState';
import { AudioManager, narrationHash, splitSentences } from '../src/services/AudioManager';
import { ProgressStorage, SAVE_KEY, type KeyValueStore } from '../src/services/Storage';
import { gameBaseUrl, parseTopicLink, topicLink } from '../src/services/links';
import { shareText } from '../src/services/share';

const answers = (correct: number, fast = 0, total = 3): AnswerResult[] =>
  Array.from({ length: total }, (_, i) => ({ correct: i < correct, fast: i < fast }));

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('game content', () => {
  const game = new GameState();

  it('has three topics, each with a medal and a narration', () => {
    expect(game.topics.value).toHaveLength(3);
    for (const topic of game.topics.value) {
      expect(game.getMedal(topic.medalId), `medal for ${topic.id}`).toBeDefined();
      expect(topic.narration.length).toBeGreaterThan(100);
      expect(topic.difficulty).toBeGreaterThanOrEqual(1);
      expect(topic.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it('has unique topic, medal and question ids', () => {
    const topicIds = game.topics.value.map((t) => t.id);
    const medalIds = game.medals.value.map((m) => m.id);
    const questionIds = game.topics.value.flatMap((t) => (t.quizQuestions ?? []).map((q) => q.id));
    expect(new Set(topicIds).size).toBe(topicIds.length);
    expect(new Set(medalIds).size).toBe(medalIds.length);
    expect(new Set(questionIds).size).toBe(questionIds.length);
  });

  it('gives every question four distinct options and a valid answer', () => {
    for (const topic of game.topics.value) {
      expect(topic.quizQuestions?.length, topic.id).toBeGreaterThan(0);
      for (const question of topic.quizQuestions ?? []) {
        expect(question.options, question.id).toHaveLength(4);
        expect(new Set(question.options).size, question.id).toBe(4);
        expect(question.correctAnswer).toBeGreaterThanOrEqual(0);
        expect(question.correctAnswer).toBeLessThanOrEqual(3);
      }
    }
  });

  it('keeps narrations to roughly 30-60 seconds of speech', () => {
    for (const topic of game.topics.value) {
      const words = topic.narration.split(/\s+/).length;
      expect(words, topic.id).toBeGreaterThanOrEqual(75);
      expect(words, topic.id).toBeLessThanOrEqual(160);
    }
  });
});

describe('scoring', () => {
  let game: GameState;
  beforeEach(() => {
    game = new GameState();
  });

  it('starts as a Recruit with nothing', () => {
    expect(game.score.value).toBe(0);
    expect(game.rank.value).toBe('Recruit');
    expect(game.earnedMedalCount).toBe(0);
    expect(game.hasProgress).toBe(false);
  });

  it('awards 10 x difficulty plus 5 per correct answer', () => {
    const award = game.completeTopic('topic3', answers(3));
    // Topic 3 has difficulty 2: 20 + 3 correct answers x 5 = 35.
    expect(award.topicPoints).toBe(20);
    expect(award.quizPoints).toBe(15);
    expect(award.speedPoints).toBe(0);
    expect(award.totalPoints).toBe(35);
    expect(game.score.value).toBe(35);
  });

  it("matches the guide's example: difficulty 3 + 3 correct answers = 45", () => {
    game.topics.set(game.topics.value.map((t) => (t.id === 'topic1' ? { ...t, difficulty: 3 } : t)));
    expect(game.completeTopic('topic1', answers(3)).totalPoints).toBe(45);
  });

  it('adds a speed bonus only for fast correct answers', () => {
    const award = game.completeTopic('topic1', [
      { correct: true, fast: true },
      { correct: true, fast: false },
      { correct: false, fast: true },
    ]);
    expect(award.correctCount).toBe(2);
    expect(award.fastCount).toBe(1);
    expect(award.speedPoints).toBe(SPEED_BONUS);
    expect(award.totalPoints).toBe(POINTS_PER_DIFFICULTY + 2 * QUIZ_BONUS + SPEED_BONUS);
  });

  it('still awards the topic points and medal with every answer wrong', () => {
    const award = game.completeTopic('topic1', answers(0));
    expect(award.totalPoints).toBe(10);
    expect(award.medal?.id).toBe('medal1');
    expect(game.getMedal('medal1')?.earned).toBe(true);
    expect(game.getTopic('topic1')?.completed).toBe(true);
  });

  it('does not award points or a medal twice for the same topic', () => {
    game.completeTopic('topic2', answers(3, 3));
    const score = game.score.value;
    const replay = game.completeTopic('topic2', answers(3, 3));
    expect(replay.firstTime).toBe(false);
    expect(replay.totalPoints).toBe(0);
    expect(replay.medal).toBeNull();
    expect(replay.correctCount).toBe(3);
    expect(game.score.value).toBe(score);
    expect(game.earnedMedalCount).toBe(1);
  });

  it('rejects an unknown topic', () => {
    expect(() => game.completeTopic('nope', [])).toThrow();
  });

  it('knows when every topic is complete', () => {
    expect(game.allTopicsCompleted).toBe(false);
    for (const id of game.topicIds) game.completeTopic(id, answers(3, 3));
    expect(game.allTopicsCompleted).toBe(true);
    expect(game.completedTopicCount).toBe(3);
    // 40 topic points + 45 quiz points + 18 speed points
    expect(game.score.value).toBe(103);
  });
});

describe('rank progression', () => {
  const setState = (game: GameState, score: number, medals: number) => {
    game.score.set(score);
    game.medals.set(game.medals.value.map((medal, i) => ({ ...medal, earned: i < medals })));
    game.updateRank();
  };

  it.each([
    [0, 0, 'Recruit'],
    [9, 3, 'Recruit'],
    [10, 0, 'Cadet'],
    [20, 0, 'Cadet'],
    [20, 1, 'Corporal'],
    [30, 1, 'Corporal'],
    [30, 2, 'Sergeant'],
    [40, 2, 'Lieutenant'],
    [50, 2, 'Lieutenant'],
    [50, 3, 'Captain'],
    [59, 3, 'Captain'],
    [60, 3, 'Colonel'],
    [500, 3, 'Colonel'],
    [500, 0, 'Cadet'],
  ])('%i points and %i medals is %s', (score, medals, expected) => {
    const game = new GameState();
    setState(game, score, medals);
    expect(game.rank.value).toBe(expected);
  });

  it('lists seven ranks from Recruit to Colonel', () => {
    expect(RANKS.map((rank) => rank.name)).toEqual([
      'Recruit', 'Cadet', 'Corporal', 'Sergeant', 'Lieutenant', 'Captain', 'Colonel',
    ]);
  });

  it('reports the promotion in the award', () => {
    const game = new GameState();
    const award = game.completeTopic('topic1', answers(2));
    expect(award.rankBefore).toBe('Recruit');
    expect(award.rankAfter).toBe('Corporal'); // 20 points, 1 medal
  });

  it('needs correct quiz answers, not just completion, to reach Colonel', () => {
    const noneRight = new GameState();
    for (const id of noneRight.topicIds) noneRight.completeTopic(id, answers(0));
    expect(noneRight.score.value).toBe(40);
    expect(noneRight.rank.value).toBe('Lieutenant');

    const someRight = new GameState();
    someRight.completeTopic('topic1', answers(2));
    someRight.completeTopic('topic2', answers(1));
    someRight.completeTopic('topic3', answers(1));
    expect(someRight.score.value).toBe(60);
    expect(someRight.rank.value).toBe('Colonel');
  });

  it('says what is needed for the next rank', () => {
    const game = new GameState();
    expect(game.nextRank).toEqual({ name: 'Cadet', pointsNeeded: 10, medalsNeeded: 0 });
    setState(game, 25, 1);
    expect(game.nextRank).toEqual({ name: 'Sergeant', pointsNeeded: 5, medalsNeeded: 1 });
    setState(game, 60, 3);
    expect(game.nextRank).toBeNull();
  });
});

describe('saving progress', () => {
  it('round-trips through storage', () => {
    const store = memoryStore();
    const storage = new ProgressStorage(store);

    const game = new GameState();
    game.startGame();
    game.completeTopic('topic1', answers(3, 1));
    game.completeTopic('topic3', answers(1));
    storage.save(game.serialize());
    expect(store.data.has(SAVE_KEY)).toBe(true);

    const restored = new GameState();
    expect(restored.restore(storage.load())).toBe(true);
    expect(restored.score.value).toBe(game.score.value);
    expect(restored.rank.value).toBe(game.rank.value);
    expect(restored.started.value).toBe(true);
    expect(restored.getTopic('topic1')?.completed).toBe(true);
    expect(restored.getTopic('topic2')?.completed).toBe(false);
    expect(restored.getMedal('medal3')?.earned).toBe(true);
  });

  it('ignores missing or damaged save data', () => {
    const store = memoryStore();
    const storage = new ProgressStorage(store);
    const game = new GameState();

    expect(game.restore(storage.load())).toBe(false);
    store.setItem(SAVE_KEY, '{not json');
    expect(game.restore(storage.load())).toBe(false);
    expect(game.restore({ version: 1, started: true, score: 'lots' })).toBe(false);
    expect(game.restore({ version: 2, started: true, score: 5, completedTopicIds: [], earnedMedalIds: [] })).toBe(false);
    expect(game.score.value).toBe(0);
  });

  it('works without any storage at all', () => {
    const storage = new ProgressStorage(null);
    expect(storage.available).toBe(false);
    expect(storage.load()).toBeNull();
    expect(() => storage.save(new GameState().serialize())).not.toThrow();
    expect(() => storage.clear()).not.toThrow();
  });

  it('reset clears everything', () => {
    const game = new GameState();
    game.startGame();
    for (const id of game.topicIds) game.completeTopic(id, answers(3, 3));
    game.reset();
    expect(game.score.value).toBe(0);
    expect(game.rank.value).toBe('Recruit');
    expect(game.earnedMedalCount).toBe(0);
    expect(game.completedTopicCount).toBe(0);
    expect(game.started.value).toBe(false);
  });
});

describe('QR code links', () => {
  const ids = ['topic1', 'topic2', 'topic3'];

  it('finds the game base address', () => {
    expect(gameBaseUrl('https://someone.github.io/Star-Of-The-West/?topic=topic2')).toBe(
      'https://someone.github.io/Star-Of-The-West/',
    );
    expect(gameBaseUrl('https://someone.github.io/Star-Of-The-West/index.html?print=1#x')).toBe(
      'https://someone.github.io/Star-Of-The-West/',
    );
    expect(gameBaseUrl('https://192.168.1.20:5173/')).toBe('https://192.168.1.20:5173/');
  });

  it('builds a link that parses back to the same topic', () => {
    const link = topicLink('https://someone.github.io/Star-Of-The-West/', 'topic2');
    expect(link).toBe('https://someone.github.io/Star-Of-The-West/?topic=topic2');
    expect(parseTopicLink(link, ids)).toBe('topic2');
  });

  it('accepts a bare topic id', () => {
    expect(parseTopicLink('  topic3 ', ids)).toBe('topic3');
  });

  it('rejects anything that is not a station code', () => {
    expect(parseTopicLink('', ids)).toBeNull();
    expect(parseTopicLink('https://example.com/', ids)).toBeNull();
    expect(parseTopicLink('https://example.com/?topic=topic9', ids)).toBeNull();
    expect(parseTopicLink('hello world', ids)).toBeNull();
    expect(parseTopicLink('WIFI:S:campus;;', ids)).toBeNull();
  });
});

describe('narration helpers', () => {
  it('splits a narration into sentences', () => {
    expect(splitSentences('First one. Second one! Is this the third? Yes')).toEqual([
      'First one.',
      'Second one!',
      'Is this the third?',
      'Yes',
    ]);
  });

  it('splits every topic narration cleanly, with no sentence cut mid-date', () => {
    for (const topic of new GameState().topics.value) {
      const sentences = splitSentences(topic.narration);
      expect(sentences.length, topic.id).toBeGreaterThanOrEqual(5);
      expect(sentences.join(' ')).toBe(topic.narration);
      for (const sentence of sentences) expect(sentence, topic.id).toMatch(/^[A-Z].*\.$/);
    }
  });

  it('fingerprints narration text', () => {
    expect(narrationHash('Hello there.')).toMatch(/^[0-9a-f]{8}$/);
    expect(narrationHash('Hello there.')).toBe(narrationHash('Hello there.'));
    expect(narrationHash('Hello there.')).not.toBe(narrationHash('Hello there!'));
  });

  describe('recorded narration', () => {
    const source = { audioFile: 'audio/topic1.mp3', narration: 'First sentence. Second sentence.' };
    const manifestFor = (hash: string) => ({
      files: { 'audio/topic1.mp3': { hash, sentences: [[0.3, 1.2], [1.6, 2.9]] } },
    });

    /** Stand in for the web server: a manifest (or none) and an audio file (or none). */
    const serve = (manifest: unknown, audioExists: boolean) =>
      vi.stubGlobal('fetch', async (url: string) =>
        url.endsWith('.json')
          ? new Response(manifest === null ? 'not found' : JSON.stringify(manifest), {
              status: manifest === null ? 404 : 200,
            })
          : new Response(null, {
              status: audioExists ? 200 : 404,
              headers: { 'content-type': audioExists ? 'audio/mpeg' : 'text/html' },
            }),
      );

    afterEach(() => vi.unstubAllGlobals());

    it('plays a recording whose text still matches', async () => {
      serve(manifestFor(narrationHash(source.narration)), true);
      const audio = new AudioManager();
      await audio.probe([source.audioFile]);
      expect(audio.modeFor(source)).toBe('mp3');
    });

    it('ignores a recording when the narration text was edited afterwards', async () => {
      serve(manifestFor(narrationHash('Some older wording.')), true);
      const audio = new AudioManager();
      await audio.probe([source.audioFile]);
      expect(audio.modeFor(source)).not.toBe('mp3');
    });

    it('plays a hand-recorded file that has no timing information', async () => {
      serve(null, true);
      const audio = new AudioManager();
      await audio.probe([source.audioFile]);
      expect(audio.modeFor(source)).toBe('mp3');
    });

    it('falls back when there is no recording', async () => {
      serve(manifestFor(narrationHash(source.narration)), false);
      const audio = new AudioManager();
      await audio.probe([source.audioFile]);
      expect(audio.modeFor(source)).not.toBe('mp3');
    });
  });

  it('writes a share message', () => {
    expect(shareText({ rank: 'Colonel', score: 123, medals: 3, totalMedals: 3 })).toContain(
      'Colonel with 123 points and 3 of 3 medals',
    );
  });
});
