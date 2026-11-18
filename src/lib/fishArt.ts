import type { FishTemplate } from '../data/templates';

const pathCache = new Map<string, Path2D>();

export function templatePath(template: FishTemplate): Path2D {
  let path = pathCache.get(template.id);
  if (!path) {
    path = new Path2D(template.path);
    pathCache.set(template.id, path);
  }
  return path;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mixHex(hex: string, target: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const mix = a.map((value, index) => Math.round(value + (b[index] - value) * amount));
  return '#' + mix.map((value) => value.toString(16).padStart(2, '0')).join('');
}

interface DrawFishOptions {
  /** Optional offscreen paint layer (any resolution, stretched to design space). */
  paint?: CanvasImageSource | null;
  paintSize?: number;
  /** Fill the silhouette with this colour instead of white. Used for bots/previews. */
  baseColor?: string | null;
  withPattern?: boolean;
  withEye?: boolean;
  withShading?: boolean;
  withOutline?: boolean;
  shadow?: boolean;
}

/**
 * Paints the layered fish into a square canvas context whose current size maps
 * to the template's 1024×1024 design space.
 */
export function drawFishArt(
  ctx: CanvasRenderingContext2D,
  template: FishTemplate,
  size: number,
  options: DrawFishOptions = {},
): void {
  const path = templatePath(template);
  const scale = size / 1024;
  const {
    paint = null,
    paintSize = 640,
    baseColor = null,
    withPattern = false,
    withEye = true,
    withShading = true,
    withOutline = true,
    shadow = false,
  } = options;

  ctx.save();
  ctx.scale(scale, scale);

  // Sticker rim — the thick white border from cute sticker artwork.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.lineWidth = 38;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(path);
  ctx.restore();

  // Layer 0 — silhouette fill.
  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(3, 26, 45, 0.35)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill(path);
    ctx.restore();
  }

  if (baseColor) {
    const gradient = ctx.createLinearGradient(220, 260, 780, 760);
    gradient.addColorStop(0, mixHex(baseColor, '#ffffff', 0.38));
    gradient.addColorStop(0.55, baseColor);
    gradient.addColorStop(1, mixHex(baseColor, '#0b3b57', 0.18));
    ctx.fillStyle = gradient;
    ctx.fill(path);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill(path);
  }

  if (baseColor && withPattern) {
    drawPattern(ctx, template, path);
  }

  // Layer 1 — children's paint, clipped by the silhouette.
  if (paint) {
    ctx.save();
    ctx.clip(path);
    ctx.drawImage(paint, 0, 0, paintSize, paintSize, 0, 0, 1024, 1024);
    ctx.restore();
  }

  // Layer 2 — specular and belly shading, also clipped.
  if (withShading) {
    ctx.save();
    ctx.clip(path);

    const topLight = ctx.createLinearGradient(0, 240, 0, 780);
    topLight.addColorStop(0, 'rgba(255,255,255,0.32)');
    topLight.addColorStop(0.38, 'rgba(255,255,255,0.05)');
    topLight.addColorStop(0.72, 'rgba(6,32,53,0.05)');
    topLight.addColorStop(1, 'rgba(6,32,53,0.2)');
    ctx.fillStyle = topLight;
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(500, 400, 20, 540, 450, 360);
    glow.addColorStop(0, 'rgba(255,255,255,0.34)');
    glow.addColorStop(0.7, 'rgba(255,255,255,0.02)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(template.eye.x - 110, template.eye.y - 95, 120, 46, -0.5, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
    ctx.restore();
  }

  // Layer 3 — outline and animated eye anchor.
  if (withOutline) {
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.92;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  }

  if (withEye) {
    drawEyeAt(ctx, template.eye.x, template.eye.y, template.eye.r);
    if (template.eye2) drawEyeAt(ctx, template.eye2.x, template.eye2.y, template.eye2.r);
  }
  drawMouth(ctx, template);

  ctx.restore();
}

function drawEyeAt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  // Socket shadow
  ctx.fillStyle = 'rgba(16, 39, 58, 0.16)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.28, r * 1.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sclera
  const sclera = ctx.createRadialGradient(x - r * 0.2, y - r * 0.28, r * 0.15, x, y, r);
  sclera.addColorStop(0, '#FFFFFF');
  sclera.addColorStop(0.8, '#F6FBFF');
  sclera.addColorStop(1, '#D6E6F1');
  ctx.fillStyle = sclera;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#1E293B';
  ctx.stroke();

  // Pupil, looking slightly forward
  ctx.fillStyle = '#13263C';
  ctx.beginPath();
  ctx.arc(x + r * 0.2, y + r * 0.06, r * 0.58, 0, Math.PI * 2);
  ctx.fill();

  // Catchlights
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x + r * 0.04, y - r * 0.24, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.arc(x + r * 0.42, y + r * 0.28, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Happy eyelid
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.1, r * 0.98, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
}

function drawMouth(ctx: CanvasRenderingContext2D, template: FishTemplate) {
  const mouth = template.mouth;
  if (!mouth) return;
  ctx.save();
  ctx.strokeStyle = '#1E293B';
  ctx.fillStyle = '#1E293B';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  if (mouth.kind === 'o') {
    ctx.beginPath();
    ctx.ellipse(mouth.x, mouth.y, mouth.w * 0.45, mouth.h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 153, 170, 0.65)';
    ctx.beginPath();
    ctx.ellipse(mouth.x, mouth.y + mouth.h * 0.18, mouth.w * 0.2, mouth.h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(mouth.x - mouth.w / 2, mouth.y);
    ctx.quadraticCurveTo(mouth.x, mouth.y + mouth.h, mouth.x + mouth.w / 2, mouth.y - 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPattern(ctx: CanvasRenderingContext2D, template: FishTemplate, path: Path2D) {
  ctx.save();
  ctx.clip(path);
  const accent = template.accent;

  if (template.pattern === 'stripes') {
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    const bands = template.id === 'angelfish' ? [430, 560, 690] : [460, 610, 760];
    for (const x of bands) {
      ctx.beginPath();
      ctx.moveTo(x - 38, 240);
      ctx.bezierCurveTo(x + 32, 380, x - 20, 600, x + 55, 790);
      ctx.lineTo(x + 102, 790);
      ctx.bezierCurveTo(x + 40, 600, x + 78, 380, x + 15, 240);
      ctx.closePath();
      ctx.fill();
    }
  } else if (template.pattern === 'spots') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const spots = [
      [430, 390, 34], [530, 340, 22], [590, 460, 30], [460, 560, 24],
      [560, 610, 38], [680, 600, 20], [380, 500, 20], [640, 380, 18],
    ];
    for (const [x, y, r] of spots) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = rgba(accent, 0.4);
    ctx.beginPath();
    ctx.arc(540, 500, 100, 0, Math.PI * 2);
    ctx.fill();
  } else if (template.pattern === 'sweep') {
    const gradient = ctx.createLinearGradient(240, 300, 820, 720);
    gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.16)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 9;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(600, 570, 160 + i * 55, Math.PI * 0.25, Math.PI * 0.85);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function renderFishCanvas(
  template: FishTemplate,
  size: number,
  options: DrawFishOptions = {},
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) drawFishArt(ctx, template, size, options);
  return canvas;
}

export function renderFishTexture(template: FishTemplate): string {
  const canvas = renderFishCanvas(template, 384, {
    baseColor: template.accent,
    withPattern: true,
    withShading: true,
    withEye: true,
  });
  return canvas.toDataURL('image/webp', 0.82);
}

export interface ExportedFish {
  dataUrl: string;
  bytes: number;
}

/**
 * Flattens all four layers, crops to the silhouette bounding box and fits the
 * result in a 384×384 transparent square. Falls back through compression
 * levels until the payload is comfortably below the 80KB server limit.
 */
export function exportFishTexture(template: FishTemplate, paint: HTMLCanvasElement): ExportedFish {
  const renderSize = 768;
  const full = document.createElement('canvas');
  full.width = renderSize;
  full.height = renderSize;
  const fullCtx = full.getContext('2d');
  if (!fullCtx) return { dataUrl: '', bytes: 0 };

  drawFishArt(fullCtx, template, renderSize, {
    paint,
    paintSize: paint.width,
    shadow: true,
  });

  const ratio = renderSize / 1024;
  const pad = 42;
  const sx = Math.max(0, (template.box.x - pad) * ratio);
  const sy = Math.max(0, (template.box.y - pad) * ratio);
  const sw = Math.min(renderSize - sx, (template.box.w + pad * 2) * ratio);
  const sh = Math.min(renderSize - sy, (template.box.h + pad * 2) * ratio);

  const out = document.createElement('canvas');
  out.width = 384;
  out.height = 384;
  const ctx = out.getContext('2d');
  if (!ctx) return { dataUrl: '', bytes: 0 };

  const fit = Math.min((384 - 16) / sw, (384 - 16) / sh);
  const dw = sw * fit;
  const dh = sh * fit;
  ctx.drawImage(full, sx, sy, sw, sh, (384 - dw) / 2, (384 - dh) / 2, dw, dh);

  return compressCanvas(out);
}

function compressCanvas(out: HTMLCanvasElement): ExportedFish {
  let dataUrl = out.toDataURL('image/webp', 0.82);
  let bytes = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
  if (bytes > 60 * 1024) {
    dataUrl = out.toDataURL('image/webp', 0.7);
    bytes = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
  }
  if (bytes > 75 * 1024) {
    dataUrl = out.toDataURL('image/webp', 0.58);
    bytes = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
  }
  return { dataUrl, bytes };
}

function alphaBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > 14) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return {
    x: Math.max(0, minX - 3),
    y: Math.max(0, minY - 3),
    w: Math.min(width, maxX - minX + 7),
    h: Math.min(height, maxY - minY + 7),
  };
}

function tintedSilhouette(source: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

/**
 * Free-draw export: the child's whole drawing becomes a sticker with a white
 * rim and a soft cocoa outline, then gets cropped into the same 384px square
 * the aquarium uses for template fish.
 */
export function exportFreeFish(paint: HTMLCanvasElement): ExportedFish {
  const bounds = alphaBounds(paint);
  if (!bounds) return { dataUrl: '', bytes: 0 };

  const art = document.createElement('canvas');
  art.width = 768;
  art.height = 768;
  const artCtx = art.getContext('2d');
  if (!artCtx) return { dataUrl: '', bytes: 0 };
  const inner = 656;
  const offset = (768 - inner) / 2;
  artCtx.drawImage(paint, offset, offset, inner, inner);

  const white = tintedSilhouette(art, '#ffffff');
  const cocoa = tintedSilhouette(art, '#5b3d49');
  const composed = document.createElement('canvas');
  composed.width = 768;
  composed.height = 768;
  const ctx = composed.getContext('2d');
  if (!ctx) return { dataUrl: '', bytes: 0 };

  const ring = (source: HTMLCanvasElement, radius: number) => {
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      ctx.drawImage(source, Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
  };

  ring(white, 21);
  ring(cocoa, 12);
  ctx.drawImage(art, 0, 0);

  const composedBounds = alphaBounds(composed) ?? { x: 0, y: 0, w: 768, h: 768 };
  const out = document.createElement('canvas');
  out.width = 384;
  out.height = 384;
  const outCtx = out.getContext('2d');
  if (!outCtx) return { dataUrl: '', bytes: 0 };
  const fit = Math.min((384 - 16) / composedBounds.w, (384 - 16) / composedBounds.h);
  const dw = composedBounds.w * fit;
  const dh = composedBounds.h * fit;
  outCtx.drawImage(
    composed,
    composedBounds.x,
    composedBounds.y,
    composedBounds.w,
    composedBounds.h,
    (384 - dw) / 2,
    (384 - dh) / 2,
    dw,
    dh,
  );
  return compressCanvas(out);
}
