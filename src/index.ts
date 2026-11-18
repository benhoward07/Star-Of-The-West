import './styles.css';
import { GameState } from './GameState';
import { ScreenManager, type AppContext } from './ScreenManager';
import { ARHuntScreen } from './components/ARHuntScreen';
import { ConclusionScreen } from './components/ConclusionScreen';
import { MedalAwardScreen } from './components/MedalAwardScreen';
import { NarrationScreen } from './components/NarrationScreen';
import { showPrintPage } from './components/PrintQRCodes';
import { QRScannerScreen } from './components/QRScannerScreen';
import { QuizScreen } from './components/QuizScreen';
import { TitleScreen } from './components/TitleScreen';
import { TopicSelectionUI } from './components/TopicSelectionUI';
import { AudioManager } from './services/AudioManager';
import { ProgressStorage } from './services/Storage';
import { parseTopicLink } from './services/links';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

const game = new GameState();
const storage = new ProgressStorage();
game.restore(storage.load());

if (new URLSearchParams(location.search).has('print')) {
  // The printable sheet of QR codes: open the game with ?print=1
  void showPrintPage(root, game);
} else {
  startGame(root);
}

function startGame(appRoot: HTMLElement): void {
  const audio = new AudioManager();
  void audio.probe(game.topics.value.map((topic) => topic.audioFile));

  appRoot.replaceChildren();
  const screens = new ScreenManager(appRoot);
  const ctx: AppContext = { game, audio, storage, screens };

  screens.register('title', new TitleScreen(ctx));
  screens.register(
    'topics',
    new TopicSelectionUI(ctx, {
      // Add a campus photo to public/images and name it here to show it above the topics:
      // locationImage: './images/summerall-field.jpg',
    }),
  );
  screens.register('narration', new NarrationScreen(ctx));
  screens.register('quiz', new QuizScreen(ctx));
  screens.register('medal', new MedalAwardScreen(ctx));
  screens.register('conclusion', new ConclusionScreen(ctx));
  screens.register('scanner', new QRScannerScreen(ctx));
  screens.register('hunt', new ARHuntScreen(ctx));

  // Remember progress on this device whenever anything changes.
  const save = () => storage.save(game.serialize());
  game.started.subscribe(save);
  game.score.subscribe(save);
  game.topics.subscribe(save);
  game.medals.subscribe(save);

  // Stop talking if the player switches apps or locks the phone.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause();
  });

  // A station QR code scanned with the phone's own camera opens the game with
  // ?topic=<id>, so go straight to that topic.
  const scannedTopic = parseTopicLink(location.href, game.topicIds);
  if (scannedTopic) {
    history.replaceState(null, '', location.pathname);
    game.startGame();
    screens.show('narration', { topicId: scannedTopic, autoplay: false });
  } else {
    screens.show('title');
  }
}
