import { Observable } from './Observable';

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  id: string;
  question: string;
  /** Exactly four answer choices. */
  options: string[];
  /** Index (0-3) of the correct option. */
  correctAnswer: number;
  /** Optional one-line fact shown after the player answers. */
  explanation?: string;
}

export interface TopicData {
  id: string;
  title: string;
  description: string;
  /** Path to recorded narration. If the file is missing, `narration` is read aloud instead. */
  audioFile: string;
  /** The narration script: shown on screen and read aloud by the phone's voice. */
  narration: string;
  /** Where this topic's QR code is posted. */
  location: string;
  /** Artwork or photo for the topic. */
  image: string;
  /** 1-5. Completing the topic is worth 10 x difficulty points. */
  difficulty: number;
  medalId: string;
  completed: boolean;
  quizQuestions?: QuizQuestion[];
}

export interface MedalData {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  /** Ribbon stripe colors, left to right. */
  ribbon: [string, string, string];
}

export interface RankInfo {
  name: string;
  minScore: number;
  minMedals: number;
}

/** How the player did on one quiz question. */
export interface AnswerResult {
  correct: boolean;
  /** Answered within the speed-bonus window. */
  fast: boolean;
}

/** What the player earned for finishing a topic. */
export interface TopicAward {
  topicId: string;
  /** False when the topic was already completed (a practice replay earns nothing). */
  firstTime: boolean;
  correctCount: number;
  questionCount: number;
  fastCount: number;
  topicPoints: number;
  quizPoints: number;
  speedPoints: number;
  totalPoints: number;
  medal: MedalData | null;
  rankBefore: string;
  rankAfter: string;
}

export interface SaveData {
  version: 1;
  started: boolean;
  score: number;
  completedTopicIds: string[];
  earnedMedalIds: string[];
}

// ---------------------------------------------------------------------------
// Scoring rules
// ---------------------------------------------------------------------------

/** Topic completion is worth this many points times the topic's difficulty. */
export const POINTS_PER_DIFFICULTY = 10;
/** Bonus for each correct quiz answer. */
export const QUIZ_BONUS = 5;
/** Extra bonus for a correct answer inside the speed window. */
export const SPEED_BONUS = 2;
/** Seconds allowed per quiz question. */
export const QUESTION_TIME_SECONDS = 20;
/** A correct answer within this many seconds earns the speed bonus. */
export const FAST_ANSWER_SECONDS = 10;

/** Ranks from lowest to highest. A rank needs BOTH its score and its medal count. */
export const RANKS: RankInfo[] = [
  { name: 'Recruit', minScore: 0, minMedals: 0 },
  { name: 'Cadet', minScore: 10, minMedals: 0 },
  { name: 'Corporal', minScore: 20, minMedals: 1 },
  { name: 'Sergeant', minScore: 30, minMedals: 2 },
  { name: 'Lieutenant', minScore: 40, minMedals: 2 },
  { name: 'Captain', minScore: 50, minMedals: 3 },
  { name: 'Colonel', minScore: 60, minMedals: 3 },
];

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export class GameState {
  public started = new Observable<boolean>(false);
  public score = new Observable<number>(0);
  public rank = new Observable<string>(RANKS[0].name);

  // Narration tip: write full words instead of abbreviations with periods
  // ("Major", not "Maj."), so the read-aloud voice pauses in the right places.
  //
  // Difficulty tip: the three topics are worth 10 + 10 + 20 = 40 points, and
  // Colonel needs 60, so players must also answer quiz questions correctly to
  // reach the top rank. Raising the difficulties makes the top rank easier.
  public topics = new Observable<TopicData[]>([
    {
      id: 'topic1',
      title: 'The Star of the West',
      description: 'Meet the steamship sent on a quiet mission to Fort Sumter.',
      audioFile: 'audio/topic1.mp3',
      narration:
        'The Star of the West was a civilian paddlewheel steamship, built in New York City for Cornelius Vanderbilt and launched in 1852. ' +
        'She spent her early years carrying passengers and mail. ' +
        'In January 1861, weeks after South Carolina declared its secession, the United States War Department chartered her for a quiet mission. ' +
        'Her task was to carry about two hundred soldiers and fresh supplies to Major Robert Anderson and his small garrison at Fort Sumter, in Charleston Harbor. ' +
        'A merchant ship was chosen instead of a warship, in the hope that she would draw less attention. ' +
        'Under Captain John McGowan, she reached the entrance to Charleston Harbor early on the morning of January 9, 1861.',
      location: 'Station 1',
      image: 'images/ship.svg',
      difficulty: 1,
      medalId: 'medal1',
      completed: false,
      quizQuestions: [
        {
          id: 't1q1',
          question: 'What kind of vessel was the Star of the West?',
          options: [
            'A United States Navy warship',
            'A civilian paddlewheel steamship',
            'An ironclad gunboat',
            'A sailing schooner',
          ],
          correctAnswer: 1,
          explanation: 'She was a merchant steamer, launched in New York in 1852.',
        },
        {
          id: 't1q2',
          question: 'What was her mission in January 1861?',
          options: [
            'To carry soldiers and supplies to Fort Sumter',
            'To blockade Charleston Harbor',
            'To deliver mail to Savannah',
            'To evacuate civilians from Charleston',
          ],
          correctAnswer: 0,
          explanation: 'The War Department chartered her to reinforce and resupply the fort.',
        },
        {
          id: 't1q3',
          question: 'Who commanded the garrison at Fort Sumter?',
          options: [
            'Captain John McGowan',
            'Cornelius Vanderbilt',
            'Cadet George Haynsworth',
            'Major Robert Anderson',
          ],
          correctAnswer: 3,
          explanation: 'Major Robert Anderson led the small United States garrison in the harbor.',
        },
      ],
    },
    {
      id: 'topic2',
      title: 'The First Shot',
      description: 'January 9, 1861: Citadel cadets man the guns on Morris Island.',
      audioFile: 'audio/topic2.mp3',
      narration:
        'On Morris Island, at the entrance to Charleston Harbor, a battery of heavy guns was manned by cadets from the South Carolina Military Academy, known today as The Citadel. ' +
        'They were chosen because they were the best trained men in Charleston to fire them. ' +
        'On the morning of January 9, 1861, the Star of the West steamed up the channel toward Fort Sumter. ' +
        'Major Peter Stevens gave the order, and Cadet George Edward Haynsworth fired a warning shot across her bow. ' +
        'More shots followed, from Morris Island and from Fort Moultrie. ' +
        'Seventeen were fired in all, and three struck the ship. ' +
        'No one was killed. ' +
        'Unable to reach the fort, Captain McGowan turned back for New York. ' +
        'Many consider these the first shots of the American Civil War, fired three months before the bombardment of Fort Sumter.',
      location: 'Station 2',
      image: 'images/cannon.svg',
      difficulty: 1,
      medalId: 'medal2',
      completed: false,
      quizQuestions: [
        {
          id: 't2q1',
          question: 'On what date did the cadets fire on the Star of the West?',
          options: ['April 12, 1861', 'December 20, 1860', 'January 9, 1861', 'July 4, 1861'],
          correctAnswer: 2,
          explanation: 'That is three months before the bombardment of Fort Sumter on April 12, 1861.',
        },
        {
          id: 't2q2',
          question: 'Where was the battery the cadets manned?',
          options: ['Morris Island', 'Fort Sumter', 'Castle Pinckney', 'James Island'],
          correctAnswer: 0,
          explanation: 'The battery stood on Morris Island, beside the shipping channel.',
        },
        {
          id: 't2q3',
          question: 'Which cadet fired the first shot?',
          options: [
            'Robert Anderson',
            'George Edward Haynsworth',
            'John McGowan',
            'Peter Stevens',
          ],
          correctAnswer: 1,
          explanation: 'Major Stevens gave the order and Cadet Haynsworth fired the warning shot.',
        },
      ],
    },
    {
      id: 'topic3',
      title: 'The Monument',
      description: 'Why the monument stands on Summerall Field, and the medal it honors.',
      audioFile: 'audio/topic3.mp3',
      narration:
        'The Star of the West Monument stands on Summerall Field, the parade ground at the heart of The Citadel. ' +
        'It was built in 1961, one hundred years after the shots were fired, through the joint efforts of the Class of 1961 and the Charleston Civil War Centennial Commission. ' +
        'The monument remembers the cadets who manned the guns on Morris Island, and it honors all Citadel graduates who have died defending their country. ' +
        'It also carries a living tradition. ' +
        'Each year, just before graduation, cadets compete to be named the best drilled cadet in the Corps. ' +
        'The winner receives the Star of the West Medal, which contains wood from the ship itself. ' +
        "The winner's name is then engraved on the monument, beside winners going back to 1886.",
      location: 'Station 3',
      image: 'images/monument.svg',
      difficulty: 2,
      medalId: 'medal3',
      completed: false,
      quizQuestions: [
        {
          id: 't3q1',
          question: 'Where does the Star of the West Monument stand?',
          options: ['Morris Island', 'Marion Square', 'Fort Sumter', 'Summerall Field'],
          correctAnswer: 3,
          explanation: "Summerall Field is The Citadel's parade ground.",
        },
        {
          id: 't3q2',
          question: 'In what year was the monument built?',
          options: ['1861', '1961', '1886', '1922'],
          correctAnswer: 1,
          explanation: 'It was built one hundred years after the shots were fired.',
        },
        {
          id: 't3q3',
          question: 'What does the Star of the West Medal recognize?',
          options: [
            'The best drilled cadet in the Corps',
            'The highest grade point average',
            'The best marksman',
            'The longest-serving officer',
          ],
          correctAnswer: 0,
          explanation: "The medal contains wood from the ship, and each winner's name goes on the monument.",
        },
      ],
    },
  ]);

  public medals = new Observable<MedalData[]>([
    {
      id: 'medal1',
      name: 'Steamship Medal',
      description: 'Learned the story of the Star of the West and her mission.',
      earned: false,
      ribbon: ['#6ae5e0', '#ffffff', '#6ae5e0'],
    },
    {
      id: 'medal2',
      name: 'First Shot Medal',
      description: 'Stood with the cadets on Morris Island on January 9, 1861.',
      earned: false,
      ribbon: ['#c0392b', '#ffffff', '#c0392b'],
    },
    {
      id: 'medal3',
      name: 'Monument Medal',
      description: 'Discovered the monument and the Star of the West Medal tradition.',
      earned: false,
      ribbon: ['#2a5caa', '#ffd700', '#2a5caa'],
    },
  ]);

  // ---- Lookups ------------------------------------------------------------

  getTopic(topicId: string): TopicData | undefined {
    return this.topics.value.find((topic) => topic.id === topicId);
  }

  getMedal(medalId: string): MedalData | undefined {
    return this.medals.value.find((medal) => medal.id === medalId);
  }

  get topicIds(): string[] {
    return this.topics.value.map((topic) => topic.id);
  }

  get earnedMedalCount(): number {
    return this.medals.value.filter((medal) => medal.earned).length;
  }

  get completedTopicCount(): number {
    return this.topics.value.filter((topic) => topic.completed).length;
  }

  get allTopicsCompleted(): boolean {
    return this.topics.value.every((topic) => topic.completed);
  }

  get hasProgress(): boolean {
    return this.score.value > 0 || this.completedTopicCount > 0;
  }

  get rankIndex(): number {
    return Math.max(0, RANKS.findIndex((rank) => rank.name === this.rank.value));
  }

  /** The next rank and what is still missing to reach it, or null at the top rank. */
  get nextRank(): { name: string; pointsNeeded: number; medalsNeeded: number } | null {
    const next = RANKS[this.rankIndex + 1];
    if (!next) return null;
    return {
      name: next.name,
      pointsNeeded: Math.max(0, next.minScore - this.score.value),
      medalsNeeded: Math.max(0, next.minMedals - this.earnedMedalCount),
    };
  }

  // ---- Actions ------------------------------------------------------------

  startGame(): void {
    if (!this.started.value) this.started.set(true);
  }

  /**
   * Finish a topic's quiz. The first completion awards points and the medal;
   * replaying a completed topic is practice only.
   */
  completeTopic(topicId: string, answers: AnswerResult[]): TopicAward {
    const topic = this.getTopic(topicId);
    if (!topic) throw new Error(`Unknown topic: ${topicId}`);

    const correctCount = answers.filter((answer) => answer.correct).length;
    const fastCount = answers.filter((answer) => answer.correct && answer.fast).length;
    const firstTime = !topic.completed;
    const rankBefore = this.rank.value;

    let topicPoints = 0;
    let quizPoints = 0;
    let speedPoints = 0;
    let medal: MedalData | null = null;

    if (firstTime) {
      topicPoints = POINTS_PER_DIFFICULTY * topic.difficulty;
      quizPoints = QUIZ_BONUS * correctCount;
      speedPoints = SPEED_BONUS * fastCount;

      this.topics.set(
        this.topics.value.map((t) => (t.id === topicId ? { ...t, completed: true } : t)),
      );
      this.medals.set(
        this.medals.value.map((m) => (m.id === topic.medalId ? { ...m, earned: true } : m)),
      );
      medal = this.getMedal(topic.medalId) ?? null;
      this.score.set(this.score.value + topicPoints + quizPoints + speedPoints);
      this.updateRank();
    }

    return {
      topicId,
      firstTime,
      correctCount,
      questionCount: answers.length,
      fastCount,
      topicPoints,
      quizPoints,
      speedPoints,
      totalPoints: topicPoints + quizPoints + speedPoints,
      medal,
      rankBefore,
      rankAfter: this.rank.value,
    };
  }

  /** Set the rank to the highest one whose score AND medal requirements are met. */
  updateRank(): void {
    const score = this.score.value;
    const medals = this.earnedMedalCount;
    let current = RANKS[0];
    for (const rank of RANKS) {
      if (score >= rank.minScore && medals >= rank.minMedals) current = rank;
    }
    if (current.name !== this.rank.value) this.rank.set(current.name);
  }

  /** Clear all progress for a fresh game. */
  reset(): void {
    this.topics.set(this.topics.value.map((topic) => ({ ...topic, completed: false })));
    this.medals.set(this.medals.value.map((medal) => ({ ...medal, earned: false })));
    this.score.set(0);
    this.started.set(false);
    this.updateRank();
  }

  // ---- Saving -------------------------------------------------------------

  serialize(): SaveData {
    return {
      version: 1,
      started: this.started.value,
      score: this.score.value,
      completedTopicIds: this.topics.value.filter((t) => t.completed).map((t) => t.id),
      earnedMedalIds: this.medals.value.filter((m) => m.earned).map((m) => m.id),
    };
  }

  /** Load saved progress. Returns false (and changes nothing) if the data is not usable. */
  restore(data: unknown): boolean {
    if (!isSaveData(data)) return false;
    const completed = new Set(data.completedTopicIds);
    const earned = new Set(data.earnedMedalIds);
    this.topics.set(this.topics.value.map((t) => ({ ...t, completed: completed.has(t.id) })));
    this.medals.set(this.medals.value.map((m) => ({ ...m, earned: earned.has(m.id) })));
    this.score.set(data.score);
    this.started.set(data.started);
    this.updateRank();
    return true;
  }
}

function isSaveData(data: unknown): data is SaveData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  const isStringArray = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  return (
    d.version === 1 &&
    typeof d.started === 'boolean' &&
    typeof d.score === 'number' &&
    Number.isFinite(d.score) &&
    d.score >= 0 &&
    isStringArray(d.completedTopicIds) &&
    isStringArray(d.earnedMedalIds)
  );
}
