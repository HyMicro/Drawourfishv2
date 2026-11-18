import type { FishTemplate } from '../data/templates';

export interface TemplateImages {
  shape: HTMLImageElement;
  details: HTMLImageElement;
  mask: HTMLCanvasElement;
  maskData: ImageData;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

export async function loadTemplateImages(template: FishTemplate): Promise<TemplateImages | null> {
  if (template.free || !template.shapeUrl || !template.detailsUrl) return null;
  const [shape, details] = await Promise.all([loadImage(template.shapeUrl), loadImage(template.detailsUrl)]);
  const mask = document.createElement('canvas');
  const maskWidth = shape.naturalWidth || 640;
  const maskHeight = shape.naturalHeight || 640;
  mask.width = maskWidth;
  mask.height = maskHeight;
  const maskCtx = mask.getContext('2d', { willReadFrequently: true });
  if (!maskCtx) return null;
  maskCtx.drawImage(shape, 0, 0, maskWidth, maskHeight);
  return { shape, details, mask, maskData: maskCtx.getImageData(0, 0, maskWidth, maskHeight) };
}

export function drawTemplateFish(
  ctx: CanvasRenderingContext2D,
  images: TemplateImages,
  paint: CanvasImageSource,
  paintSize: number,
  size: number,
): void {
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(images.shape, 0, 0, size, size);

  const scratch = document.createElement('canvas');
  scratch.width = size;
  scratch.height = size;
  const sctx = scratch.getContext('2d');
  if (sctx) {
    sctx.drawImage(paint, 0, 0, paintSize, paintSize, 0, 0, size, size);
    sctx.globalCompositeOperation = 'destination-in';
    sctx.drawImage(images.shape, 0, 0, size, size);
    sctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(scratch, 0, 0);
  }

  ctx.drawImage(images.details, 0, 0, size, size);
}

export function rgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export interface ExportedFish {
  dataUrl: string;
  bytes: number;
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

export function exportTemplateFish(images: TemplateImages, paint: HTMLCanvasElement): ExportedFish {
  const size = 640;
  const full = document.createElement('canvas');
  full.width = size;
  full.height = size;
  const ctx = full.getContext('2d');
  if (!ctx) return { dataUrl: '', bytes: 0 };
  drawTemplateFish(ctx, images, paint, paint.width, size);

  const out = document.createElement('canvas');
  out.width = 384;
  out.height = 384;
  const outCtx = out.getContext('2d');
  if (!outCtx) return { dataUrl: '', bytes: 0 };
  outCtx.drawImage(full, 0, 0, 384, 384);
  return compressCanvas(out);
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
    x: Math.max(0, minX - 6),
    y: Math.max(0, minY - 6),
    w: Math.min(width, maxX - minX + 13),
    h: Math.min(height, maxY - minY + 13),
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
 * Free-draw export: the drawing becomes a sticker with a white rim and a soft
 * cocoa outline, then gets cropped into a 384px square.
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
