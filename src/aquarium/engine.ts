// Pixi's default uniform/shader sync uses `new Function`. This official
// polyfill swaps in eval-free implementations so the app can run under a
// strict CSP (script-src 'self', no unsafe-eval).
import 'pixi.js/unsafe-eval';
import {
  Application,
  Container,
  Graphics,
  Mesh,
  MeshGeometry,
  Sprite,
  Text,
  Texture,
  type Ticker,
} from 'pixi.js';
import type { EmoteKind, FishEntity, FishState, FishSync } from '../../shared/protocol';
import { EMOTES, FEED_GROWTH, MAX_FISH_GROWTH } from '../../shared/protocol';
import { getTemplate } from '../data/templates';
import { sound } from '../lib/audio';
import { clamp, createId, easeOutCubic, randomBetween, smoothNoise } from '../lib/utils';

const SEGMENTS = 16;
const ROPE_TEXTURE_SIZE = 384;
const MAX_PELLETS = 14;

interface Swimmer {
  fish: FishEntity;
  root: Container;
  display: Mesh | Sprite | null;
  texture: Texture | null;
  meshGeometry: MeshGeometry | null;
  size: number;
  baseSize: number;
  growth: number;
  /** How much the local mesh space (384px) is scaled to reach the display size. */
  displayScale: number;
  x: number;
  y: number;
  tilt: number;
  speed: number;
  baseSpeed: number;
  targetX: number;
  targetY: number;
  retargetAt: number;
  state: FishState;
  stateUntil: number;
  facing: 1 | -1;
  visualFacing: number;
  flipPulse: number;
  phase: number;
  seed: number;
  squash: number;
  age: number;
  hidden: boolean;
  label: Container | null;
  isMine: boolean;
  isBot: boolean;
  remoteTargetX: number;
  remoteTargetY: number;
  lastRemoteAt: number;
  remoteIdle: boolean;
}

interface Pellet {
  id: string;
  gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  wobble: number;
}

interface Bubble {
  sprite: Sprite;
  speed: number;
  sway: number;
  phase: number;
}

interface BurstParticle {
  view: Sprite | Text;
  vx: number;
  vy: number;
  age: number;
  life: number;
  spin: number;
}

interface Ripple {
  gfx: Graphics;
  x: number;
  y: number;
  age: number;
  life: number;
}

interface BackgroundFish {
  sprite: Sprite;
  speed: number;
  direction: 1 | -1;
  baseY: number;
  sway: number;
  phase: number;
  width: number;
}

export interface AquariumCallbacks {
  onFishTap: (fish: FishEntity, clientX: number, clientY: number) => void;
  onWaterTap: (xNorm: number, yNorm: number, clientX: number, clientY: number) => void;
  onPelletConsumed: (pelletId: string, fishId: string) => void;
}

function shortestAngle(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function makeBubbleTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const glow = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    glow.addColorStop(0, 'rgba(230, 252, 255, 0.08)');
    glow.addColorStop(0.72, 'rgba(207, 247, 255, 0.16)');
    glow.addColorStop(0.9, 'rgba(226, 252, 255, 0.38)');
    glow.addColorStop(1, 'rgba(226, 252, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235, 253, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 32, 25, 0.2, Math.PI * 1.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.beginPath();
    ctx.ellipse(22, 20, 5.5, 3.4, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  return Texture.from(canvas);
}

async function loadTexture(dataUrl: string): Promise<Texture> {
  const image = new Image();
  image.decoding = 'async';
  image.src = dataUrl;
  await image.decode();
  const texture = Texture.from(image);
  texture.source.scaleMode = 'linear';
  return texture;
}

export class AquariumEngine {
  private container: HTMLElement;
  private ownerId: string;
  private callbacks: AquariumCallbacks;
  private app: Application | null = null;

  private backgroundSprite: Sprite | null = null;
  private backgroundTexture: Texture | null = null;
  private raysSprite: Sprite | null = null;
  private bubbleTexture: Texture | null = null;
  private fishLayer = new Container();
  private bubbleLayer = new Container();
  private labelLayer = new Container();
  private bgFishLayer = new Container();
  private pelletLayer = new Container();
  private fxLayer = new Container();
  private backgroundFish: BackgroundFish[] = [];
  private silhouetteTextures: Texture[] = [];
  private swimmers = new Map<string, Swimmer>();
  private pellets = new Map<string, Pellet>();
  private bubbles: Bubble[] = [];
  private particles: BurstParticle[] = [];
  private ripples: Ripple[] = [];
  private pendingFishes: FishEntity[] = [];
  private pendingHidden: string[] = [];
  private loading = new Set<string>();
  private resizeObserver: ResizeObserver | null = null;
  private ready = false;
  private destroyed = false;
  private time = 0;
  private scaleFactor = 1;
  private pointer: {
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
    menuOpened: boolean;
    fishId: string | null;
  } | null = null;
  private pressTimer: number | null = null;
  private resizeTimer: number | null = null;

  constructor(container: HTMLElement, ownerId: string, callbacks: AquariumCallbacks) {
    this.container = container;
    this.ownerId = ownerId;
    this.callbacks = callbacks;
  }

  async init() {
    const app = new Application();
    await app.init({
      resizeTo: this.container,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    if (this.destroyed) {
      app.destroy(true, { children: true });
      return;
    }
    this.app = app;
    const canvas = app.canvas;
    canvas.setAttribute('aria-label', 'Akuarium online bersama. Ketuk ikan untuk menyapa.');
    canvas.style.touchAction = 'none';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.container.appendChild(canvas);

    app.stage.addChild(
      this.bgFishLayer,
      this.bubbleLayer,
      this.fishLayer,
      this.labelLayer,
      this.pelletLayer,
      this.fxLayer,
    );
    this.bubbleTexture = makeBubbleTexture();
    await this.setupBackground();
    this.buildAmbientBubbles();
    this.attachPointer(canvas);
    app.ticker.add(this.tick);

    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeTimer !== null) window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.handleResize(), 120);
    });
    this.resizeObserver.observe(this.container);

    this.ready = true;
    this.syncFishes(this.pendingFishes, this.pendingHidden);
    return this;
  }

  private get width() {
    return this.app?.screen.width ?? this.container.clientWidth;
  }

  private get height() {
    return this.app?.screen.height ?? this.container.clientHeight;
  }

  private baseScale() {
    const w = this.width;
    if (w < 640) return 0.68;
    if (w < 1024) return 0.86;
    return clamp(w / 1280, 0.94, 1.18);
  }

  private async setupBackground() {
    if (!this.app) return;
    try {
      this.backgroundTexture = await loadTexture('/underwater-bg.webp');
      if (!this.app || this.destroyed) return;
      const sprite = new Sprite(this.backgroundTexture);
      sprite.anchor.set(0.5);
      this.backgroundSprite = sprite;
      this.app.stage.addChildAt(sprite, 0);
      this.layoutBackground();
      this.buildRays();
      await this.loadSilhouettes();
    } catch (error) {
      console.warn('[aquarium] background image failed', error);
    }
  }

  private layoutBackground() {
    if (!this.app || !this.backgroundSprite) return;
    const width = this.width;
    const height = this.height;
    const scale = Math.max(width / 1920, height / 1080);
    this.backgroundSprite.width = 1920 * scale;
    this.backgroundSprite.height = 1080 * scale;
    this.backgroundSprite.position.set(width / 2, height / 2);
  }

  private buildRays() {
    if (!this.app) return;
    const width = Math.max(320, this.width);
    const height = Math.max(320, this.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(1280, width);
    canvas.height = Math.min(720, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rw = canvas.width;
    const rh = canvas.height;
    for (let i = 0; i < 5; i++) {
      const x = rw * (0.2 + i * 0.15);
      const spread = rw * (0.035 + (i % 3) * 0.018);
      const beam = ctx.createLinearGradient(x, 0, x + rh * 0.3, rh);
      beam.addColorStop(0, 'rgba(232, 255, 255, 0.34)');
      beam.addColorStop(0.45, 'rgba(215, 251, 255, 0.08)');
      beam.addColorStop(1, 'rgba(215, 251, 255, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - spread, 0);
      ctx.lineTo(x + spread, 0);
      ctx.lineTo(x + rh * 0.38 + spread, rh);
      ctx.lineTo(x + rh * 0.38 - spread, rh);
      ctx.closePath();
      ctx.fill();
    }
    if (this.raysSprite) {
      this.app.stage.removeChild(this.raysSprite);
      this.raysSprite.texture.destroy(true);
      this.raysSprite.destroy();
    }
    const texture = Texture.from(canvas);
    this.raysSprite = new Sprite(texture);
    this.raysSprite.width = width;
    this.raysSprite.height = height;
    this.raysSprite.blendMode = 'screen';
    this.raysSprite.alpha = 0.2;
    this.app.stage.addChildAt(this.raysSprite, 1);
  }

  private async loadSilhouettes() {
    if (!this.app || this.backgroundFish.length > 0) return;
    const configs: Array<{ src: string; width: number; alpha: number; speed: number; y: number }> = [
      { src: 'school-far', width: 190, alpha: 0.2, speed: 5, y: 0.25 },
      { src: 'school-mid', width: 230, alpha: 0.24, speed: 8, y: 0.35 },
      { src: 'school-near', width: 270, alpha: 0.28, speed: 12, y: 0.48 },
      { src: 'fish-c', width: 70, alpha: 0.3, speed: 10, y: 0.58 },
      { src: 'fish-a', width: 102, alpha: 0.25, speed: 7, y: 0.4 },
      { src: 'fish-e', width: 100, alpha: 0.28, speed: 9, y: 0.65 },
    ];
    const results = await Promise.allSettled(
      configs.map(async (cfg) => ({ cfg, texture: await loadTexture(`/silhouettes/${cfg.src}.png`) })),
    );
    if (!this.app || this.destroyed) return;
    const width = this.width;
    const height = this.height;
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { cfg, texture } = result.value;
      this.silhouetteTextures.push(texture);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = cfg.width;
      sprite.height = texture.height * (cfg.width / texture.width);
      sprite.alpha = cfg.alpha;
      sprite.x = randomBetween(-width * 0.08, width * 1.08);
      sprite.y = cfg.y * height + randomBetween(-18, 18);
      const direction: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
      // Every silhouette source looks right. Mirror it when it swims left so
      // the head always leads the movement.
      sprite.scale.x = Math.abs(sprite.scale.x) * direction;
      this.bgFishLayer.addChild(sprite);
      this.backgroundFish.push({
        sprite,
        speed: cfg.speed,
        direction,
        baseY: cfg.y,
        sway: randomBetween(3, 10),
        phase: randomBetween(0, Math.PI * 2),
        width: cfg.width,
      });
    }
  }

  private updateBackgroundFish(dt: number) {
    const width = this.width;
    const height = this.height;
    for (const fish of this.backgroundFish) {
      fish.sprite.x += fish.direction * fish.speed * dt;
      fish.sprite.y = fish.baseY * height + Math.sin(this.time * 0.22 + fish.phase) * fish.sway;
      const half = fish.width / 2;
      if (fish.direction === 1 && fish.sprite.x - half > width) {
        fish.sprite.x = -half;
        fish.direction = 1;
        fish.baseY = clamp(fish.baseY + randomBetween(-0.08, 0.08), 0.18, 0.7);
      } else if (fish.direction === -1 && fish.sprite.x + half < 0) {
        fish.sprite.x = width + half;
        fish.direction = -1;
        fish.baseY = clamp(fish.baseY + randomBetween(-0.08, 0.08), 0.18, 0.7);
      }
    }
  }

  private buildAmbientBubbles() {
    if (!this.app || !this.bubbleTexture) return;
    for (const bubble of this.bubbles) {
      bubble.sprite.destroy();
    }
    this.bubbles = [];
    const count = this.width < 640 ? 16 : 30;
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(this.bubbleTexture);
      sprite.anchor.set(0.5);
      sprite.alpha = randomBetween(0.22, 0.55);
      const scale = randomBetween(0.18, 0.7);
      sprite.scale.set(scale);
      sprite.x = randomBetween(0, this.width);
      sprite.y = randomBetween(0, this.height);
      this.bubbleLayer.addChild(sprite);
      this.bubbles.push({
        sprite,
        speed: randomBetween(12, 38),
        sway: randomBetween(8, 28),
        phase: randomBetween(0, Math.PI * 2),
      });
    }
  }

  private attachPointer(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    window.addEventListener('blur', this.onPointerCancel);
  }

  private localPoint(event: PointerEvent) {
    const rect = this.app?.canvas.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.width,
      y: ((event.clientY - rect.top) / rect.height) * this.height,
    };
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.app) return;
    sound.unlock();
    const point = this.localPoint(event);
    const fish = this.findFish(point.x, point.y);
    this.pointer = {
      id: event.pointerId,
      x: point.x,
      y: point.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      menuOpened: false,
      fishId: fish?.fish.id ?? null,
    };
    try {
      this.app.canvas.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (fish) {
      this.pressTimer = window.setTimeout(() => {
        if (!this.pointer || this.pointer.moved || this.pointer.fishId !== fish.fish.id) return;
        this.pointer.menuOpened = true;
        this.callbacks.onFishTap(fish.fish, this.pointer.startX, this.pointer.startY);
      }, 1850);
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.pointer) return;
    if (Math.hypot(event.clientX - this.pointer.startX, event.clientY - this.pointer.startY) > 12) {
      this.pointer.moved = true;
      this.clearPressTimer();
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.app || !this.pointer) return;
    this.clearPressTimer();
    const pointer = this.pointer;
    this.pointer = null;
    if (pointer.moved) return;

    if (pointer.fishId) {
      if (pointer.menuOpened) return;
      const swimmer = this.swimmers.get(pointer.fishId);
      if (swimmer) {
        this.callbacks.onFishTap(swimmer.fish, event.clientX, event.clientY);
      }
      return;
    }

    const point = this.localPoint(event);
    this.triggerRipple(point.x, point.y);
    this.alertFish(point.x, point.y);
    this.callbacks.onWaterTap(
      clamp(point.x / this.width, 0, 1),
      clamp(point.y / this.height, 0, 1),
      event.clientX,
      event.clientY,
    );
  };

  private onPointerCancel = () => {
    this.clearPressTimer();
    this.pointer = null;
  };

  private clearPressTimer() {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  private findFish(x: number, y: number): Swimmer | null {
    let best: Swimmer | null = null;
    let bestDistance = Infinity;
    for (const swimmer of this.swimmers.values()) {
      if (swimmer.hidden || swimmer.age < 0.2) continue;
      const dx = x - swimmer.x;
      const dy = y - swimmer.y;
      const hit = swimmer.size * 0.44;
      const distance = Math.hypot(dx, dy);
      if (distance < hit && distance < bestDistance) {
        best = swimmer;
        bestDistance = distance;
      }
    }
    return best;
  }

  syncFishes(fishes: FishEntity[], hiddenIds: string[]) {
    this.pendingFishes = fishes;
    this.pendingHidden = hiddenIds;
    if (!this.ready) return;
    const wanted = new Set(fishes.map((fish) => fish.id));
    for (const [id, swimmer] of this.swimmers) {
      if (!wanted.has(id)) {
        this.removeSwimmer(id);
        swimmer.hidden = true;
      }
    }
    for (const fish of fishes) {
      if (!this.swimmers.has(fish.id) && !this.loading.has(fish.id)) {
        void this.addSwimmer(fish);
      }
    }
    for (const swimmer of this.swimmers.values()) {
      const hidden = hiddenIds.includes(swimmer.fish.id);
      swimmer.hidden = hidden;
      swimmer.root.visible = !hidden;
      if (swimmer.label) swimmer.label.visible = !hidden;
    }
  }

  private createNameLabel(name: string): Container {
    const label = new Text({
      text: name.length > 16 ? `${name.slice(0, 15)}…` : name,
      style: {
        fontFamily: '"Nunito Variable", "Segoe UI", sans-serif',
        fontSize: 11,
        fontWeight: '800',
        fill: '#4b372c',
      },
    });
    label.anchor.set(0.5);
    const padX = 7;
    const padY = 4;
    const bg = new Graphics();
    bg.roundRect(
      -label.width / 2 - padX,
      -label.height / 2 - padY,
      label.width + padX * 2,
      label.height + padY * 2,
      7,
    )
      .fill({ color: 0xfff8ea, alpha: 0.84 })
      .stroke({ color: 0xffffff, width: 1.5, alpha: 0.9 });
    const wrapper = new Container();
    wrapper.addChild(bg, label);
    wrapper.alpha = 0.94;
    wrapper.visible = false;
    return wrapper;
  }

  private async addSwimmer(fish: FishEntity) {
    if (!this.app || this.destroyed || this.swimmers.has(fish.id)) return;
    this.loading.add(fish.id);
    try {
      const texture = await loadTexture(fish.textureData);
      if (this.destroyed || !this.pendingFishes.some((item) => item.id === fish.id)) {
        texture.destroy(true);
        return;
      }
      const template = getTemplate(fish.templateId);
      const growth = clamp(fish.growth ?? 1, 1, MAX_FISH_GROWTH);
      const baseSize = Math.max(92, 156 * template.size * this.baseScale());
      const size = baseSize * growth;
      const root = new Container();
      let display: Mesh | Sprite;
      let meshGeometry: MeshGeometry | null = null;

      if (template.motion === 'drift') {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.width = size;
        sprite.height = size;
        display = sprite;
        root.addChild(sprite);
      } else {
        const columns = SEGMENTS + 1;
        const positions = new Float32Array(columns * 4);
        const uvs = new Float32Array(columns * 4);
        for (let i = 0; i < columns; i++) {
          const x = -ROPE_TEXTURE_SIZE / 2 + (ROPE_TEXTURE_SIZE * i) / SEGMENTS;
          const offset = i * 4;
          positions[offset] = x;
          positions[offset + 1] = -ROPE_TEXTURE_SIZE / 2;
          positions[offset + 2] = x;
          positions[offset + 3] = ROPE_TEXTURE_SIZE / 2;
          uvs[offset] = i / SEGMENTS;
          uvs[offset + 1] = 0;
          uvs[offset + 2] = i / SEGMENTS;
          uvs[offset + 3] = 1;
        }
        const indices = new Uint32Array(SEGMENTS * 6);
        for (let i = 0; i < SEGMENTS; i++) {
          const vertex = i * 2;
          const index = i * 6;
          indices[index] = vertex;
          indices[index + 1] = vertex + 1;
          indices[index + 2] = vertex + 2;
          indices[index + 3] = vertex + 2;
          indices[index + 4] = vertex + 1;
          indices[index + 5] = vertex + 3;
        }
        meshGeometry = new MeshGeometry({ positions, uvs, indices });
        const mesh = new Mesh({ geometry: meshGeometry, texture });
        display = mesh;
        root.addChild(mesh);
      }

      const marginX = Math.max(46, size * 0.52);
      const x = clamp(
        clamp(fish.transform.x, 0.04, 0.96) * this.width,
        marginX,
        this.width - marginX,
      );
      const y = clamp(
        clamp(fish.transform.y, 0.14, 0.88) * this.height,
        this.height * 0.12 + size * 0.22,
        this.height * 0.9,
      );
      root.x = x;
      root.y = y;
      root.alpha = 0;
      root.scale.set(0.55);
      this.fishLayer.addChild(root);

      const isMine = fish.ownerId === this.ownerId;
      const isBot = fish.ownerId.startsWith('bot-');
      const facing = fish.transform.facing === -1 ? -1 : 1;
      const swimmer: Swimmer = {
        fish,
        root,
        display,
        texture,
        meshGeometry,
        size,
        baseSize,
        growth,
        displayScale: template.motion === 'drift' ? 1 : size / ROPE_TEXTURE_SIZE,
        x,
        y,
        tilt: 0,
        speed: 8,
        baseSpeed: (32 + (fish.transform.speed || 0.45) * 42) * this.scaleFactor,
        targetX: x,
        targetY: y,
        retargetAt: 0,
        state: 'WANDER',
        stateUntil: 0,
        facing,
        visualFacing: facing,
        flipPulse: 0,
        phase: randomBetween(0, Math.PI * 2),
        seed: Math.random() * 10,
        squash: 0,
        age: 0,
        hidden: this.pendingHidden.includes(fish.id),
        label: null,
        isMine,
        isBot,
        remoteTargetX: x,
        remoteTargetY: y,
        lastRemoteAt: 0,
        remoteIdle: !isMine && !isBot,
      };
      root.visible = !swimmer.hidden;
      swimmer.label = this.createNameLabel(fish.name);
      this.labelLayer.addChild(swimmer.label);
      this.swimmers.set(fish.id, swimmer);
      this.burstBubbles(x, y, 8, 0.7);
      if (isMine) sound.splash();
    } catch (error) {
      console.warn('[aquarium] texture failed', error);
    } finally {
      this.loading.delete(fish.id);
    }
  }

  private removeSwimmer(id: string) {
    const swimmer = this.swimmers.get(id);
    if (!swimmer) return;
    this.swimmers.delete(id);
    swimmer.label?.destroy({ children: true });
    swimmer.root.destroy({ children: true });
    swimmer.texture?.destroy(true);
  }

  private tick = (ticker: Ticker) => {
    if (!this.app || this.destroyed) return;
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    this.time += dt;
    const width = this.width;
    const height = this.height;
    const now = this.time;

    if (this.raysSprite) {
      this.raysSprite.alpha = 0.16 + Math.sin(now * 0.22) * 0.045;
      this.raysSprite.x = Math.sin(now * 0.08) * 14;
    }
    this.updateBackgroundFish(dt);

    for (const bubble of this.bubbles) {
      bubble.sprite.y -= bubble.speed * dt;
      bubble.sprite.x += Math.sin(now * 0.7 + bubble.phase) * bubble.sway * dt;
      if (bubble.sprite.y < -30) {
        bubble.sprite.y = height + 30;
        bubble.sprite.x = randomBetween(0, width);
      }
    }

    for (const swimmer of this.swimmers.values()) {
      this.updateSwimmer(swimmer, dt, now);
    }

    this.updatePellets(dt, now);
    this.updateParticles(dt);
    this.updateRipples(dt, now);
  };

  private updateSwimmer(swimmer: Swimmer, dt: number, now: number) {
    swimmer.age = Math.min(1.2, swimmer.age + dt);
    if (swimmer.hidden) return;
    const width = this.width;
    const height = this.height;
    const intro = easeOutCubic(Math.min(1, swimmer.age / 0.55));
    swimmer.root.alpha = Math.min(1, swimmer.age / 0.32);
    const remote = !swimmer.isMine && !swimmer.isBot;

    let moved = 0;
    if (remote && !swimmer.remoteIdle) {
      const tx = swimmer.remoteTargetX;
      const ty = swimmer.remoteTargetY;
      const k = 1 - Math.exp(-8.5 * dt);
      const oldX = swimmer.x;
      const oldY = swimmer.y;
      swimmer.x += (tx - swimmer.x) * k;
      swimmer.y += (ty - swimmer.y) * k;
      moved = Math.hypot(swimmer.x - oldX, swimmer.y - oldY);
      if (moved > 0.35) {
        const dx = swimmer.x - oldX;
        const dy = swimmer.y - oldY;
        const direction = dx >= 0 ? 1 : -1;
        const targetTilt = clamp(Math.atan2(dy, Math.abs(dx)), -0.45, 0.45);
        if (direction !== swimmer.facing) swimmer.facing = direction as 1 | -1;
        swimmer.tilt += (targetTilt - swimmer.tilt) * Math.min(1, dt * 7);
      }
      swimmer.speed += (moved / Math.max(dt, 0.001) - swimmer.speed) * Math.min(1, dt * 6);
      if (now - swimmer.lastRemoteAt > 5) {
        // The owner closed the tab or lost connection. Keep their fish alive
        // by switching to the same autonomous wander used by local fish.
        swimmer.remoteIdle = true;
        swimmer.state = 'WANDER';
        swimmer.retargetAt = 0;
      }
    } else {
      this.updateLocalBehavior(swimmer, dt, now);
      const speed = swimmer.state === 'SEEK_FOOD' ? swimmer.baseSpeed * 1.8 : swimmer.state === 'CURIOUS_TAP' ? swimmer.baseSpeed * 1.25 : swimmer.baseSpeed;
      swimmer.speed += (speed - swimmer.speed) * Math.min(1, dt * 3.2);
      swimmer.x += Math.cos(swimmer.tilt) * swimmer.facing * swimmer.speed * dt;
      swimmer.y += Math.sin(swimmer.tilt) * swimmer.speed * dt;
      const marginX = Math.max(46, swimmer.size * 0.52);
      swimmer.x = clamp(swimmer.x, marginX, width - marginX);
      swimmer.y = clamp(swimmer.y, height * 0.12 + swimmer.size * 0.22, height * 0.9);
      this.checkPelletCollision(swimmer);
    }

    // Flip instantly but add a 250ms squash pulse. Interpolating scale through
    // zero made fish look like vertical slivers mid-turn.
    if (swimmer.visualFacing !== swimmer.facing) {
      swimmer.visualFacing = swimmer.facing;
      swimmer.flipPulse = 1;
    }
    swimmer.flipPulse = Math.max(0, swimmer.flipPulse - dt * 4);
    swimmer.squash = Math.max(0, swimmer.squash - dt * 2.6);

    const targetRotation = swimmer.facing * swimmer.tilt;
    swimmer.root.rotation += shortestAngle(swimmer.root.rotation, targetRotation) * Math.min(1, dt * 9);
    swimmer.root.x = swimmer.x;
    swimmer.root.y = swimmer.y;
    if (swimmer.label) {
      swimmer.label.position.set(swimmer.x, swimmer.y - swimmer.size * 0.52);
      swimmer.label.alpha = 0.94 * Math.min(1, intro);
      swimmer.label.visible = !swimmer.hidden && swimmer.age > 0.12;
    }
    const squashX = (1 + swimmer.squash * 0.13) * (1 - swimmer.flipPulse * 0.16);
    const squashY = 1 - swimmer.squash * 0.16;
    const displayScale = swimmer.displayScale;
    swimmer.root.scale.set(
      swimmer.visualFacing * intro * squashX * displayScale,
      intro * squashY * displayScale,
    );

    const speedRatio = clamp(swimmer.speed / 90, 0, 1.4);
    swimmer.phase += dt * (3.2 + speedRatio * 3.4 + (swimmer.state === 'SEEK_FOOD' ? 1.4 : 0));
    const amplitude = ROPE_TEXTURE_SIZE * (0.04 + speedRatio * 0.028);

    if (swimmer.display instanceof Mesh && swimmer.meshGeometry) {
      const buffer = swimmer.meshGeometry.getBuffer('aPosition');
      const positions = buffer.data as Float32Array;
      const half = ROPE_TEXTURE_SIZE / 2;
      for (let i = 0; i <= SEGMENTS; i++) {
        const fromHead = SEGMENTS - i;
        const factor = Math.pow(fromHead / SEGMENTS, 1.6);
        const offset = i * 4;
        const phase = 1.15 * fromHead - swimmer.phase + Math.sin(now * 0.5 + swimmer.seed) * 0.25;
        const swayX = Math.sin(phase) * amplitude * factor;
        const swayY = Math.sin(phase + 0.9) * amplitude * factor * 0.28;
        const baseX = -half + (ROPE_TEXTURE_SIZE * i) / SEGMENTS;
        positions[offset] = baseX + swayX;
        positions[offset + 1] = -half + swayY;
        positions[offset + 2] = baseX + swayX;
        positions[offset + 3] = half + swayY;
      }
      buffer.update();
    } else if (swimmer.display instanceof Sprite) {
      swimmer.display.y = Math.sin(now * 1.4 + swimmer.seed) * 4;
      swimmer.display.rotation = Math.sin(now * 0.8 + swimmer.seed) * 0.06;
    }

    // Gentle vertical bob for all fish.
    if (!remote) {
      swimmer.root.y += Math.sin(now * 1.1 + swimmer.seed) * 0.9;
    }
  }

  private updateLocalBehavior(swimmer: Swimmer, dt: number, now: number) {
    const width = this.width;
    const height = this.height;
    if (swimmer.state === 'CURIOUS_TAP' && now > swimmer.stateUntil) {
      swimmer.state = 'WANDER';
      swimmer.retargetAt = 0;
    }

    let nearest: Pellet | null = null;
    let nearestDistance = Infinity;
    for (const pellet of this.pellets.values()) {
      const distance = Math.hypot(pellet.x - swimmer.x, pellet.y - swimmer.y);
      if (distance < nearestDistance) {
        nearest = pellet;
        nearestDistance = distance;
      }
    }
    if (nearest && nearestDistance < 470 && swimmer.state !== 'CURIOUS_TAP') {
      swimmer.state = 'SEEK_FOOD';
      swimmer.targetX = nearest.x;
      swimmer.targetY = nearest.y;
    } else if (swimmer.state === 'SEEK_FOOD') {
      swimmer.state = 'WANDER';
      swimmer.retargetAt = 0;
    }

    if (swimmer.state === 'WANDER' && now * 1000 > swimmer.retargetAt) {
      const marginX = 70;
      const marginTop = height * 0.18;
      const marginBottom = height * 0.84;
      swimmer.targetX = randomBetween(marginX, width - marginX);
      swimmer.targetY = randomBetween(marginTop, marginBottom);
      swimmer.retargetAt = now * 1000 + randomBetween(2800, 6800);
    }

    const dx = swimmer.targetX - swimmer.x;
    const dy = swimmer.targetY - swimmer.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 44 && swimmer.state === 'WANDER') {
      swimmer.retargetAt = 0;
    }

    let desired = Math.atan2(dy, dx);
    desired += smoothNoise(swimmer.seed, now) * (swimmer.state === 'WANDER' ? 0.34 : 0.1);

    let steerX = Math.cos(desired);
    let steerY = Math.sin(desired);
    if (swimmer.x < 80) steerX += (80 - swimmer.x) / 80;
    if (swimmer.x > width - 80) steerX -= (swimmer.x - (width - 80)) / 80;
    if (swimmer.y < height * 0.16) steerY += 0.9;
    if (swimmer.y > height * 0.87) steerY -= 0.9;
    // Use a horizontal facing + shallow tilt instead of a full 360° angle.
    // Turning around mirrors the fish; it never rotates through a vertical pose.
    const direction = Math.cos(desired) >= 0 ? 1 : -1;
    if (direction !== swimmer.facing) {
      swimmer.facing = direction as 1 | -1;
      swimmer.flipPulse = 1;
      swimmer.seed = Math.random() * 10;
    }
    const targetTilt = clamp(Math.atan2(steerY, Math.abs(steerX)), -0.5, 0.5);
    swimmer.tilt += (targetTilt - swimmer.tilt) * Math.min(1, dt * 3);
  }

  private checkPelletCollision(swimmer: Swimmer) {
    const hit = swimmer.size * 0.3;
    for (const pellet of this.pellets.values()) {
      if (Math.hypot(pellet.x - swimmer.x, pellet.y - swimmer.y) < hit) {
        this.eatPellet(pellet, swimmer);
        break;
      }
    }
  }

  private eatPellet(pellet: Pellet, swimmer: Swimmer) {
    this.removePellet(pellet.id);
    this.applyGrowth(swimmer.fish.id, swimmer.growth + FEED_GROWTH);
    swimmer.squash = 1;
    this.emitEmoji('❤️', swimmer.x, swimmer.y - swimmer.size * 0.3, 1.5);
    this.burstBubbles(swimmer.x, swimmer.y, 4, 0.4);
    sound.munch();
    this.callbacks.onPelletConsumed(pellet.id, swimmer.fish.id);
  }

  private updatePellets(dt: number, _now: number) {
    for (const pellet of [...this.pellets.values()]) {
      pellet.age += dt;
      pellet.vy += 28 * dt;
      pellet.y += pellet.vy * dt;
      pellet.x += Math.sin(pellet.age * 2.3 + pellet.wobble) * 9 * dt;
      if (pellet.y > this.height * 0.9) {
        pellet.vy = -pellet.vy * 0.1;
        pellet.y = this.height * 0.9;
      }
      pellet.gfx.x = pellet.x;
      pellet.gfx.y = pellet.y;
      pellet.gfx.rotation += dt * 0.7;
      if (pellet.age > 26) this.removePellet(pellet.id);
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.age += dt;
      particle.view.x += particle.vx * dt;
      particle.view.y += particle.vy * dt;
      particle.vy -= 12 * dt;
      particle.view.alpha = Math.max(0, 1 - particle.age / particle.life);
      particle.view.rotation += particle.spin * dt;
      particle.view.scale.set(1 + Math.sin(particle.age * 4) * 0.06);
      if (particle.age >= particle.life) {
        particle.view.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  private updateRipples(dt: number, _now: number) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const ripple = this.ripples[i];
      ripple.age += dt;
      const progress = ripple.age / ripple.life;
      ripple.gfx.clear();
      for (let ring = 0; ring < 2; ring++) {
        const radius = 10 + progress * 96 + ring * 24;
        const alpha = Math.max(0, 0.42 * (1 - progress)) * (ring === 0 ? 1 : 0.55);
        ripple.gfx
          .circle(0, 0, radius)
          .stroke({ width: ring === 0 ? 2.4 : 1.4, color: 0xd8feff, alpha });
      }
      if (ripple.age >= ripple.life) {
        ripple.gfx.destroy();
        this.ripples.splice(i, 1);
      }
    }
  }

  private makePellet(id: string, x: number, y: number): Pellet {
    const gfx = new Graphics();
    gfx.circle(0, 0, 7).fill({ color: 0xc78448 });
    gfx.circle(-2, -2, 2.4).fill({ color: 0xf4c88c, alpha: 0.85 });
    gfx.x = x;
    gfx.y = y;
    this.pelletLayer.addChild(gfx);
    const pellet: Pellet = {
      id,
      gfx,
      x,
      y,
      vx: 0,
      vy: randomBetween(6, 18),
      age: 0,
      wobble: Math.random() * 10,
    };
    this.pellets.set(id, pellet);
    while (this.pellets.size > MAX_PELLETS) {
      const oldest = this.pellets.values().next().value as Pellet | undefined;
      if (!oldest) break;
      this.removePellet(oldest.id);
    }
    return pellet;
  }

  addPellet(id: string, xNorm: number, yNorm: number) {
    if (!this.app || this.pellets.has(id)) return;
    const x = clamp(xNorm, 0.04, 0.96) * this.width;
    const y = clamp(yNorm, 0.06, 0.7) * this.height;
    this.makePellet(id, x, y);
  }

  spawnFeeding(count = 5): Array<{ id: string; x: number; y: number }> {
    if (!this.app) return [];
    const dropped: Array<{ id: string; x: number; y: number }> = [];
    const targets = [...this.swimmers.values()]
      .filter((swimmer) => !swimmer.hidden)
      .sort((a, b) => Number(b.isMine) - Number(a.isMine))
      .slice(0, count);
    for (let i = 0; i < count; i++) {
      let xNorm = clamp(0.5 + randomBetween(-0.17, 0.17), 0.08, 0.92);
      let yNorm = clamp(0.1 + randomBetween(-0.03, 0.05), 0.06, 0.28);
      const target = targets[i];
      if (target) {
        // Drop food near the fish too, with the player's own fish first, so
        // feeding actually reaches a fish before the resident bots eat it all.
        xNorm = clamp(target.x / this.width + randomBetween(-0.08, 0.08), 0.08, 0.92);
        yNorm = clamp(target.y / this.height + randomBetween(-0.05, 0.05), 0.08, 0.82);
      }
      const id = createId();
      this.addPellet(id, xNorm, yNorm);
      dropped.push({ id, x: xNorm, y: yNorm });
    }
    this.burstBubbles(this.width * 0.5, this.height * 0.12, 7, 0.5);
    sound.pop();
    return dropped;
  }

  removePellet(id: string) {
    const pellet = this.pellets.get(id);
    if (!pellet) return;
    pellet.gfx.destroy();
    this.pellets.delete(id);
  }

  applyRemoteSync(updates: FishSync[]) {
    for (const update of updates) {
      const swimmer = this.swimmers.get(update.id);
      if (!swimmer || swimmer.isMine || swimmer.isBot) continue;
      const marginX = Math.max(46, swimmer.size * 0.52);
      swimmer.remoteTargetX = clamp(update.x, 0, 1) * this.width;
      swimmer.remoteTargetY = clamp(update.y, 0, 1) * this.height;
      swimmer.remoteTargetX = clamp(swimmer.remoteTargetX, marginX, this.width - marginX);
      swimmer.remoteTargetY = clamp(
        swimmer.remoteTargetY,
        this.height * 0.12 + swimmer.size * 0.2,
        this.height * 0.9,
      );
      swimmer.state = update.state;
      swimmer.facing = update.facing === -1 ? -1 : 1;
      swimmer.lastRemoteAt = this.time;
      swimmer.remoteIdle = false;
    }
  }

  applyGrowth(fishId: string, value: number) {
    const swimmer = this.swimmers.get(fishId);
    if (!swimmer) return;
    const growth = clamp(value, 1, MAX_FISH_GROWTH);
    if (growth <= swimmer.growth + 0.001) return;
    swimmer.growth = growth;
    swimmer.fish.growth = growth;
    swimmer.size = swimmer.baseSize * growth;
    if (swimmer.display instanceof Sprite) {
      swimmer.display.width = swimmer.size;
      swimmer.display.height = swimmer.size;
    } else {
      swimmer.displayScale = swimmer.size / ROPE_TEXTURE_SIZE;
    }
    swimmer.squash = 0.8;
  }

  getLocalSyncs(): FishSync[] {
    const updates: FishSync[] = [];
    for (const swimmer of this.swimmers.values()) {
      if (!swimmer.isMine || swimmer.hidden) continue;
      updates.push({
        id: swimmer.fish.id,
        x: clamp(swimmer.x / this.width, 0, 1),
        y: clamp(swimmer.y / this.height, 0, 1),
        targetX: clamp(swimmer.targetX / this.width, 0, 1),
        targetY: clamp(swimmer.targetY / this.height, 0, 1),
        state: swimmer.state,
        facing: swimmer.facing,
      });
    }
    return updates;
  }

  triggerRipple(x: number, y: number) {
    return this.addRipple(x, y);
  }

  private addRipple(x: number, y: number) {
    if (!this.app) return;
    const gfx = new Graphics();
    gfx.x = x;
    gfx.y = y;
    this.fxLayer.addChild(gfx);
    this.ripples.push({ gfx, x, y, age: 0, life: 1.35 });
    this.burstBubbles(x, y, 5, 0.4);
    sound.pop();
  }

  remoteTap(xNorm: number, yNorm: number) {
    if (!this.app) return;
    const x = clamp(xNorm, 0, 1) * this.width;
    const y = clamp(yNorm, 0, 1) * this.height;
    this.addRipple(x, y);
    this.alertFish(x, y);
  }

  alertFish(x: number, y: number) {
    const radius = 480 * this.scaleFactor;
    for (const swimmer of this.swimmers.values()) {
      if (!swimmer.isMine && !swimmer.isBot) continue;
      if (Math.hypot(swimmer.x - x, swimmer.y - y) < radius) {
        swimmer.state = 'CURIOUS_TAP';
        swimmer.stateUntil = this.time + 3;
        swimmer.targetX = clamp(x + randomBetween(-40, 40), 40, this.width - 40);
        swimmer.targetY = clamp(y + randomBetween(-30, 30), this.height * 0.14, this.height * 0.86);
      }
    }
  }

  playEmote(fishId: string, emote: EmoteKind) {
    const swimmer = this.swimmers.get(fishId);
    if (!swimmer) return;
    const emoji = EMOTES[emote] ?? '✨';
    this.emitEmoji(emoji, swimmer.x, swimmer.y - swimmer.size * 0.32, 1.8);
    sound.emote();
  }

  private emitEmoji(emoji: string, x: number, y: number, life: number) {
    if (!this.app) return;
    const text = new Text({
      text: emoji,
      style: {
        fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
        fontSize: 30,
        align: 'center',
      },
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    this.fxLayer.addChild(text);
    this.particles.push({
      view: text,
      vx: randomBetween(-12, 12),
      vy: randomBetween(-55, -34),
      age: 0,
      life,
      spin: randomBetween(-0.4, 0.4),
    });
  }

  private burstBubbles(x: number, y: number, count: number, power: number) {
    if (!this.app || !this.bubbleTexture) return;
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(this.bubbleTexture);
      sprite.anchor.set(0.5);
      const scale = randomBetween(0.12, 0.42) * power;
      sprite.scale.set(scale);
      sprite.alpha = randomBetween(0.5, 0.9);
      sprite.x = x + randomBetween(-14, 14);
      sprite.y = y + randomBetween(-10, 10);
      this.fxLayer.addChild(sprite);
      this.particles.push({
        view: sprite,
        vx: randomBetween(-22, 22),
        vy: randomBetween(-55, -20) * power,
        age: 0,
        life: randomBetween(0.7, 1.6),
        spin: 0,
      });
    }
  }

  private handleResize() {
    if (!this.app) return;
    this.scaleFactor = this.baseScale();
    this.layoutBackground();
    this.buildRays();
    this.buildAmbientBubbles();
    for (const swimmer of this.swimmers.values()) {
      swimmer.x = clamp(swimmer.x, 46, this.width - 46);
      swimmer.y = clamp(swimmer.y, this.height * 0.12, this.height * 0.9);
      swimmer.remoteTargetX = clamp(swimmer.remoteTargetX, 46, this.width - 46);
      swimmer.remoteTargetY = clamp(swimmer.remoteTargetY, this.height * 0.12, this.height * 0.9);
    }
    for (const fish of this.backgroundFish) {
      fish.sprite.y = fish.baseY * this.height;
      if (fish.sprite.x < -fish.width || fish.sprite.x > this.width + fish.width) {
        fish.sprite.x = fish.direction === 1 ? -fish.width / 2 : this.width + fish.width / 2;
      }
    }
  }

  capture(): HTMLCanvasElement | null {
    if (!this.app) return null;
    try {
      return this.app.renderer.extract.canvas({
        target: this.app.stage,
        resolution: Math.min(2, window.devicePixelRatio || 1),
      }) as HTMLCanvasElement;
    } catch (error) {
      console.warn('[aquarium] capture failed', error);
      return null;
    }
  }

  destroy() {
    this.destroyed = true;
    this.ready = false;
    this.clearPressTimer();
    if (this.resizeTimer !== null) window.clearTimeout(this.resizeTimer);
    this.resizeObserver?.disconnect();
    const canvas = this.app?.canvas;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      canvas.removeEventListener('pointercancel', this.onPointerCancel);
    }
    window.removeEventListener('blur', this.onPointerCancel);
    for (const swimmer of this.swimmers.values()) {
      swimmer.label?.destroy({ children: true });
      swimmer.texture?.destroy(true);
    }
    this.swimmers.clear();
    this.pellets.clear();
    this.bubbleTexture?.destroy(true);
    this.backgroundTexture?.destroy(true);
    this.raysSprite?.texture.destroy(true);
    for (const texture of this.silhouetteTextures) texture.destroy(true);
    this.silhouetteTextures = [];
    if (this.app) {
      this.app.ticker.remove(this.tick);
      this.app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
    }
    this.app = null;
  }
}
