import type {
  Group,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  Texture,
  WebGLRenderer,
} from 'three';
import type { TopicData } from '../GameState';
import type { AppContext, Screen } from '../ScreenManager';
import { buzz, el } from '../dom';
import { aimedCode, mulberry32, pitchOf, placeCodes, zoneForPitch, type PlacedCode } from '../services/hunt';
import { gameBaseUrl, topicLink } from '../services/links';

type Three = typeof import('three');

/** How far away the cubes float, and how big they are, in the 3D view's units. */
const CODE_DISTANCE = 5;
const CODE_SIZE = 1;
/** How long the ring must stay on a cube to scan it. */
const LOCK_SECONDS = 1;
/** After this long without finding anything, an arrow points the way. */
const HINT_AFTER_SECONDS = 12;
/** View angle along the long side of the screen, roughly what a phone camera sees. */
const LONG_SIDE_FOV = 62;

const TEAL = 0x6ae5e0;
const GOLD = 0xffd700;

interface CodeObject {
  placed: PlacedCode;
  topic: TopicData;
  /** Unit direction, copied from `placed`, in the shape aimedCode() wants. */
  direction: PlacedCode['direction'];
  pivot: Group;
  cube: Mesh;
  baseY: number;
  phase: number;
}

interface World {
  T: Three;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** Holds every cube; turned so "straight ahead" matches where the player first faced. */
  codesRoot: Group;
  /** Stars and a horizon line, shown only when there is no camera picture. */
  backdrop: Object3D;
  codes: CodeObject[];
  disposables: Array<{ dispose(): void }>;
}

type MotionPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * The 3D code hunt: the camera view with QR code cubes floating around the
 * player. Tilt the phone up for the sky codes, hold it level for the wall
 * codes, and keep the ring on a cube to scan it.
 */
export class ARHuntScreen implements Screen {
  readonly element: HTMLElement;

  private stage: HTMLElement;
  private video: HTMLVideoElement;
  private canvasHolder: HTMLElement;
  private reticle: HTMLElement;
  private arrow: HTMLElement;
  private counter: HTMLElement;
  private tip: HTMLElement;
  private note: HTMLElement;
  private intro: HTMLElement;
  private introStatus: HTMLElement;
  private startButton: HTMLButtonElement;
  private foundCard: HTMLElement;

  /** Bumped each time the screen opens or closes, so a slow start can be abandoned. */
  private session = 0;
  private world: World | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private lastTime = 0;

  /** Latest reading from the phone's motion sensors, in degrees. */
  private reading: { alpha: number; beta: number; gamma: number } | null = null;
  private motionActive = false;
  /** Look direction when dragging instead of tilting, in degrees. */
  private dragYaw = 0;
  private dragPitch = 0;
  private dragPointer: number | null = null;
  private dragLast = { x: 0, y: 0 };

  private lockTarget: CodeObject | null = null;
  private lockProgress = 0;
  /** A code the player chose to leave; it cannot lock again until they look away. */
  private dismissed: CodeObject | null = null;
  private showingFound: CodeObject | null = null;
  private idleSeconds = 0;
  private tipText = '';
  private reducedMotion = false;

  constructor(private ctx: AppContext) {
    this.video = el('video', { class: 'hunt-video', playsinline: true, muted: true, autoplay: true });
    this.canvasHolder = el('div', { class: 'hunt-canvas-holder' });
    this.reticle = el('div', {
      class: 'hunt-reticle',
      'aria-hidden': 'true',
      html:
        '<svg viewBox="0 0 100 100">' +
        '<circle class="reticle-track" cx="50" cy="50" r="44"/>' +
        '<circle class="reticle-fill" cx="50" cy="50" r="44" pathLength="100"/>' +
        '<circle class="reticle-dot" cx="50" cy="50" r="3"/>' +
        '</svg>',
    });
    this.arrow = el('div', { class: 'hunt-arrow', 'aria-hidden': 'true' }, el('span', {}));
    this.counter = el('p', { class: 'hunt-counter' });
    this.tip = el('p', { class: 'hunt-tip' });
    this.note = el('p', { class: 'hunt-note' });
    this.foundCard = el('div', { class: 'hunt-found', role: 'dialog', 'aria-live': 'polite' });

    this.introStatus = el('p', { class: 'hunt-intro-status', 'aria-live': 'polite' });
    this.startButton = el(
      'button',
      { class: 'btn primary', type: 'button', onClick: () => void this.begin() },
      'Start Hunt',
    );
    this.intro = el(
      'div',
      { class: 'hunt-intro' },
      el(
        'div',
        { class: 'card hunt-intro-card' },
        el('p', { class: 'eyebrow' }, '3D code hunt'),
        el('h1', { class: 'screen-title' }, 'Find the Floating Codes'),
        el(
          'p',
          {},
          'Three QR code cubes are floating around you. At least one is up in the sky and at least one is at wall level.',
        ),
        el(
          'p',
          {},
          'Turn and tilt your phone to find them, then hold the ring on a cube to scan it. They move to new spots every hunt.',
        ),
        el('p', { class: 'muted' }, 'Your phone will ask to use its motion sensors and camera.'),
        this.introStatus,
        el(
          'div',
          { class: 'actions' },
          this.startButton,
          el(
            'button',
            { class: 'btn ghost', type: 'button', onClick: () => ctx.screens.show('topics') },
            'Back to topics',
          ),
        ),
      ),
    );

    this.stage = el(
      'div',
      { class: 'hunt-stage' },
      el('div', { class: 'hunt-sky', 'aria-hidden': 'true' }),
      this.video,
      this.canvasHolder,
      this.reticle,
      this.arrow,
      el(
        'div',
        { class: 'hunt-top' },
        el(
          'button',
          { class: 'hunt-back', type: 'button', onClick: () => ctx.screens.show('topics') },
          '‹ Topics',
        ),
        this.counter,
      ),
      el('div', { class: 'hunt-bottom' }, this.tip, this.note),
      this.foundCard,
      this.intro,
    );

    this.element = el('main', { class: 'hunt-screen' }, this.stage);
  }

  onShow(): void {
    this.session++;
    this.teardown();
    this.intro.hidden = false;
    this.introStatus.textContent = '';
    this.startButton.disabled = false;
    this.stage.classList.remove('hunting', 'no-camera');
    this.hideFound();
    this.updateCounter();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  onHide(): void {
    this.session++;
    this.teardown();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  // ---- Starting up -------------------------------------------------------

  /** Runs from the Start Hunt tap, which is what lets the phone ask for permissions. */
  private async begin(): Promise<void> {
    const session = this.session;
    this.startButton.disabled = true;
    this.introStatus.textContent = 'Starting...';

    // Ask for motion first: iPhone only allows the question straight after a tap.
    const motionAllowed = await this.requestMotion();
    if (session !== this.session) return;

    const [world, hasCamera] = await Promise.all([this.buildWorld(), this.startCamera()]);
    if (session !== this.session) {
      this.disposeWorld(world);
      this.stopCamera();
      return;
    }
    if (!world) {
      this.stopCamera();
      this.startButton.disabled = false;
      this.introStatus.textContent =
        'The 3D view could not start on this device. Go back and tap a topic instead.';
      return;
    }

    this.world = world;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.stage.classList.toggle('no-camera', !hasCamera);
    this.stage.classList.add('hunting');
    world.backdrop.visible = !hasCamera;
    this.intro.hidden = true;

    this.reading = null;
    this.motionActive = false;
    this.dragYaw = 0;
    this.dragPitch = 0;
    this.lockTarget = null;
    this.lockProgress = 0;
    this.dismissed = null;
    this.idleSeconds = 0;
    this.tipText = '';

    if (motionAllowed) window.addEventListener('deviceorientation', this.onOrientation);
    window.addEventListener('resize', this.onResize);
    const canvas = world.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);

    const notes: string[] = [];
    if (!hasCamera) notes.push('Camera is off, so you are seeing a night sky.');
    notes.push(motionAllowed ? 'No motion? Drag the picture to look around.' : 'Drag the picture to look around.');
    this.note.textContent = notes.join(' ');

    this.onResize();
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private async requestMotion(): Promise<boolean> {
    const api = (window as { DeviceOrientationEvent?: MotionPermission }).DeviceOrientationEvent;
    if (!api) return false;
    if (typeof api.requestPermission !== 'function') return true;
    try {
      return (await api.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }

  private async startCamera(): Promise<boolean> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play().catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  private async buildWorld(): Promise<World | null> {
    try {
      const [T, { default: QRCode }] = await Promise.all([import('three'), import('qrcode')]);
      const disposables: World['disposables'] = [];
      const keep = <D extends { dispose(): void }>(item: D): D => {
        disposables.push(item);
        return item;
      };

      const canvas = el('canvas', { class: 'hunt-canvas' });
      const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      this.canvasHolder.replaceChildren(canvas);

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(LONG_SIDE_FOV, 1, 0.1, 200);
      const codesRoot = new T.Group();
      scene.add(codesRoot);

      const box = keep(new T.BoxGeometry(CODE_SIZE, CODE_SIZE, CODE_SIZE));
      const edges = keep(new T.EdgesGeometry(new T.BoxGeometry(CODE_SIZE * 1.06, CODE_SIZE * 1.06, CODE_SIZE * 1.06)));
      const glow = keep(this.glowTexture(T));

      const { game } = this.ctx;
      const base = gameBaseUrl();
      const placed = placeCodes(game.topicIds, mulberry32((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0));
      const codes: CodeObject[] = [];

      for (const [index, spot] of placed.entries()) {
        const topic = game.getTopic(spot.topicId);
        if (!topic) continue;
        const color = topic.completed ? GOLD : TEAL;

        // Each face is a real QR code holding this station's link.
        const face = document.createElement('canvas');
        await QRCode.toCanvas(face, topicLink(base, topic.id), {
          width: 256,
          margin: 2,
          color: { dark: '#10102a', light: topic.completed ? '#ffe9a0' : '#ffffff' },
        });
        if (topic.completed) this.drawCheck(face);
        const texture = keep(new T.CanvasTexture(face));
        texture.colorSpace = T.SRGBColorSpace;
        texture.magFilter = T.NearestFilter;

        const cube = new T.Mesh(box, keep(new T.MeshBasicMaterial({ map: texture })));
        const frame = new T.LineSegments(edges, keep(new T.LineBasicMaterial({ color })));
        cube.add(frame);
        cube.rotation.set(0.35, 0.6 + index, 0);

        const halo = new T.Sprite(
          keep(
            new T.SpriteMaterial({
              map: glow,
              color,
              transparent: true,
              opacity: 0.6,
              depthWrite: false,
              blending: T.AdditiveBlending,
            }),
          ),
        );
        halo.scale.setScalar(CODE_SIZE * 3.2);

        const pivot = new T.Group();
        pivot.position.set(
          spot.direction.x * CODE_DISTANCE,
          spot.direction.y * CODE_DISTANCE,
          spot.direction.z * CODE_DISTANCE,
        );
        pivot.add(halo, cube);
        codesRoot.add(pivot);

        codes.push({
          placed: spot,
          topic,
          direction: spot.direction,
          pivot,
          cube,
          baseY: pivot.position.y,
          phase: index * 2.1,
        });
      }

      const backdrop = this.buildBackdrop(T, keep);
      scene.add(backdrop);

      return { T, renderer, scene, camera, codesRoot, backdrop, codes, disposables };
    } catch {
      return null;
    }
  }

  /** Soft round glow used behind each cube. */
  private glowTexture(T: Three): Texture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    if (g) {
      const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gradient;
      g.fillRect(0, 0, size, size);
    }
    return new T.CanvasTexture(canvas);
  }

  /** Gold check badge in the middle of a finished station's code. */
  private drawCheck(canvas: HTMLCanvasElement): void {
    const g = canvas.getContext('2d');
    if (!g) return;
    const c = canvas.width / 2;
    const r = canvas.width * 0.2;
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.fillStyle = '#ffd700';
    g.fill();
    g.lineWidth = canvas.width * 0.02;
    g.strokeStyle = '#10102a';
    g.stroke();
    g.beginPath();
    g.moveTo(c - r * 0.5, c);
    g.lineTo(c - r * 0.1, c + r * 0.4);
    g.lineTo(c + r * 0.55, c - r * 0.4);
    g.lineWidth = canvas.width * 0.05;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  }

  /** Stars and a horizon line, so looking around is visible without a camera picture. */
  private buildBackdrop(T: Three, keep: <D extends { dispose(): void }>(item: D) => D): Object3D {
    const group = new T.Group();
    const rng = mulberry32(1861);

    const starCount = 420;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      // Evenly spread over the upper part of the sky.
      const y = rng() * 1.05 - 0.05;
      const around = rng() * Math.PI * 2;
      const flat = Math.sqrt(Math.max(0, 1 - y * y));
      positions[i * 3] = Math.cos(around) * flat * 60;
      positions[i * 3 + 1] = y * 60;
      positions[i * 3 + 2] = Math.sin(around) * flat * 60;
    }
    const stars = keep(new T.BufferGeometry());
    stars.setAttribute('position', new T.BufferAttribute(positions, 3));
    group.add(
      new T.Points(
        stars,
        keep(new T.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.85 })),
      ),
    );

    const ringPoints = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      ringPoints.push(new T.Vector3(Math.cos(a) * 40, -1.2, Math.sin(a) * 40));
    }
    const ring = keep(new T.BufferGeometry().setFromPoints(ringPoints));
    group.add(new T.Line(ring, keep(new T.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.45 }))));

    return group;
  }

  // ---- Shutting down -----------------------------------------------------

  private teardown(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener('deviceorientation', this.onOrientation);
    window.removeEventListener('resize', this.onResize);
    this.stopCamera();
    this.disposeWorld(this.world);
    this.world = null;
    this.canvasHolder.replaceChildren();
    this.dragPointer = null;
    this.lockTarget = null;
    this.showingFound = null;
  }

  private disposeWorld(world: World | null): void {
    if (!world) return;
    for (const item of world.disposables) item.dispose();
    world.renderer.dispose();
    // Phones only allow a few 3D views at once, so hand this one back.
    world.renderer.forceContextLoss();
  }

  // ---- Looking around ----------------------------------------------------

  private onOrientation = (event: DeviceOrientationEvent): void => {
    if (event.alpha === null || event.beta === null || event.gamma === null) return;
    this.reading = { alpha: event.alpha, beta: event.beta, gamma: event.gamma };
  };

  private onVisibility = (): void => {
    if (!document.hidden && this.stream) void this.video.play().catch(() => undefined);
    this.lastTime = performance.now();
  };

  private onResize = (): void => {
    const world = this.world;
    if (!world) return;
    const width = this.stage.clientWidth || 1;
    const height = this.stage.clientHeight || 1;
    world.renderer.setSize(width, height, false);
    const aspect = width / height;
    world.camera.aspect = aspect;
    // Keep the wide view along the long side of the screen, like the phone's camera.
    world.camera.fov =
      aspect <= 1
        ? LONG_SIDE_FOV
        : (2 * Math.atan(Math.tan((LONG_SIDE_FOV * Math.PI) / 360) / aspect) * 180) / Math.PI;
    world.camera.updateProjectionMatrix();
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (this.motionActive) return;
    this.dragPointer = event.pointerId;
    this.dragLast = { x: event.clientX, y: event.clientY };
    try {
      // Keeps the drag going if the finger slides off the picture.
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Not every browser can do this; dragging still works without it.
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.dragPointer !== event.pointerId || this.motionActive || !this.world) return;
    const degreesPerPixel = this.world.camera.fov / (this.stage.clientHeight || 1);
    // The picture follows the finger, like dragging a panorama.
    this.dragYaw -= (event.clientX - this.dragLast.x) * degreesPerPixel;
    this.dragPitch += (event.clientY - this.dragLast.y) * degreesPerPixel;
    this.dragPitch = Math.max(-85, Math.min(85, this.dragPitch));
    this.dragLast = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.dragPointer === event.pointerId) this.dragPointer = null;
  };

  /** Turn the camera to match the phone (or the dragging finger). */
  private updateCamera(world: World, dt: number): void {
    const { T, camera } = world;
    const rad = Math.PI / 180;

    if (!this.reading) {
      camera.quaternion.setFromEuler(new T.Euler(this.dragPitch * rad, -this.dragYaw * rad, 0, 'YXZ'));
      return;
    }

    // The standard conversion from a phone's alpha/beta/gamma to a 3D rotation.
    const { alpha, beta, gamma } = this.reading;
    const screenAngle = (screen.orientation?.angle ?? Number((window as { orientation?: number }).orientation ?? 0)) * rad;
    const target = new T.Quaternion()
      .setFromEuler(new T.Euler(beta * rad, alpha * rad, -gamma * rad, 'YXZ'))
      // The camera looks out of the back of the phone, not out of the top edge.
      .multiply(new T.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2))
      .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), -screenAngle));

    if (this.motionActive) {
      camera.quaternion.slerp(target, Math.min(1, dt * 14));
      return;
    }

    // First reading: wherever the player is facing right now becomes "straight ahead".
    camera.quaternion.copy(target);
    const forward = new T.Vector3(0, 0, -1).applyQuaternion(target);
    let heading = forward;
    if (Math.hypot(forward.x, forward.z) < 0.35) {
      // Pointing at the sky or the floor: use the top edge of the phone instead.
      const top = new T.Vector3(0, 1, 0).applyQuaternion(target);
      heading = forward.y > 0 ? top.negate() : top;
    }
    world.codesRoot.rotation.y = -Math.atan2(heading.x, -heading.z);
    world.codesRoot.updateMatrixWorld(true);
    this.motionActive = true;
    this.note.textContent = this.stage.classList.contains('no-camera')
      ? 'Camera is off, so you are seeing a night sky.'
      : '';
  }

  // ---- Every frame -------------------------------------------------------

  private frame = (now: number): void => {
    const world = this.world;
    if (!world) return;
    this.raf = requestAnimationFrame(this.frame);
    // Capped so a stalled frame cannot fling the cubes around, but high enough
    // that scanning still takes about a second on a slow phone.
    const dt = Math.min(0.25, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const { T, camera } = world;

    this.updateCamera(world, dt);

    // Where the centre of the view points, measured the same way the codes were placed.
    const forwardWorld = new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const forward = forwardWorld.clone().applyQuaternion(world.codesRoot.quaternion.clone().invert());

    const aimed = this.showingFound ? null : aimedCode(forward, world.codes);
    if (this.dismissed && aimed !== this.dismissed) this.dismissed = null;
    const target = aimed && aimed !== this.dismissed ? aimed : null;

    if (target && target === this.lockTarget) {
      this.lockProgress = Math.min(1, this.lockProgress + dt / LOCK_SECONDS);
    } else {
      this.lockTarget = target;
      this.lockProgress = 0;
    }
    this.reticle.style.setProperty('--progress', this.lockProgress.toFixed(3));
    this.reticle.classList.toggle('locking', !!target);

    this.idleSeconds = target || this.showingFound ? 0 : this.idleSeconds + dt;
    this.updateArrow(world, forward);
    this.updateTip(forward, !!target);
    this.animateCodes(world, now / 1000, dt, this.showingFound ?? target);

    world.renderer.render(world.scene, camera);

    if (target && this.lockProgress >= 1) this.showFound(target);
  };

  private animateCodes(world: World, time: number, dt: number, active: CodeObject | null): void {
    for (const code of world.codes) {
      const isActive = code === active;
      if (!this.reducedMotion) {
        code.cube.rotation.y += dt * (isActive ? 2.4 : 0.45);
        code.cube.rotation.x = 0.35 + Math.sin(time * 0.6 + code.phase) * 0.18;
        code.pivot.position.y = code.baseY + Math.sin(time * 1.1 + code.phase) * 0.12;
      }
      const scale = code.pivot.scale.x + ((isActive ? 1.25 : 1) - code.pivot.scale.x) * Math.min(1, dt * 8);
      code.pivot.scale.setScalar(scale);
    }
  }

  /** After a while with no luck, point toward the nearest station still to do. */
  private updateArrow(world: World, forward: { x: number; y: number; z: number }): void {
    let show = false;
    if (this.idleSeconds >= HINT_AFTER_SECONDS) {
      const { T, camera } = world;
      let nearest: CodeObject | null = null;
      let nearestDot = -Infinity;
      for (const code of world.codes) {
        if (code.topic.completed) continue;
        const dot = forward.x * code.direction.x + forward.y * code.direction.y + forward.z * code.direction.z;
        if (dot > nearestDot) {
          nearestDot = dot;
          nearest = code;
        }
      }
      // Hide the arrow once the cube is comfortably in view (within about 18 degrees).
      if (nearest && nearestDot < 0.95) {
        const inView = nearest.pivot
          .getWorldPosition(new T.Vector3())
          .applyQuaternion(camera.quaternion.clone().invert());
        const angle = (Math.atan2(inView.x, inView.y) * 180) / Math.PI;
        this.arrow.style.setProperty('--angle', `${angle.toFixed(1)}deg`);
        show = true;
      }
    }
    this.arrow.classList.toggle('show', show);
  }

  private updateTip(forward: { x: number; y: number; z: number }, locking: boolean): void {
    let text: string;
    if (locking) text = 'Hold steady...';
    else {
      const zone = zoneForPitch(pitchOf(forward));
      text =
        zone === 'sky'
          ? 'Looking at the sky'
          : zone === 'ground'
            ? 'Nothing on the ground. Look up.'
            : 'Looking at wall level';
    }
    if (text !== this.tipText) {
      this.tipText = text;
      this.tip.textContent = text;
    }
  }

  // ---- Finding a code ----------------------------------------------------

  private updateCounter(): void {
    const { game } = this.ctx;
    this.counter.textContent = `${game.completedTopicCount} of ${game.topicIds.length} complete`;
  }

  private showFound(code: CodeObject): void {
    const { game, screens } = this.ctx;
    this.showingFound = code;
    this.lockTarget = null;
    this.lockProgress = 0;
    buzz(80);

    const where = code.placed.zone === 'sky' ? 'Found in the sky' : 'Found at wall level';
    this.foundCard.replaceChildren(
      el('p', { class: 'eyebrow' }, code.topic.completed ? `${where} · already complete` : where),
      el('h2', { class: 'hunt-found-title' }, code.topic.title),
      el('p', { class: 'muted' }, code.topic.description),
      el(
        'div',
        { class: 'actions' },
        el(
          'button',
          {
            class: 'btn primary',
            type: 'button',
            // Opening from a tap lets the narration start playing straight away.
            onClick: () => {
              game.startGame();
              screens.show('narration', { topicId: code.topic.id, autoplay: true });
            },
          },
          code.topic.completed ? 'Practice Again' : 'Open Station',
        ),
        el(
          'button',
          {
            class: 'btn ghost',
            type: 'button',
            onClick: () => {
              this.dismissed = code;
              this.hideFound();
            },
          },
          'Keep looking',
        ),
      ),
    );
    this.foundCard.classList.add('show');
    this.stage.classList.add('has-found');
  }

  private hideFound(): void {
    this.showingFound = null;
    this.foundCard.classList.remove('show');
    this.foundCard.replaceChildren();
    this.stage.classList.remove('has-found');
  }
}
