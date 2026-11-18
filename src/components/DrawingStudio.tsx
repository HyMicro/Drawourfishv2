import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FishTemplate } from '../data/templates';
import { STUDIO_SWATCHES, TEMPLATES, TEMPLATE_MAP } from '../data/templates';
import {
  drawTemplateFish,
  exportFreeFish,
  exportTemplateFish,
  hexToRgb,
  loadTemplateImages,
  rgba,
  type TemplateImages,
} from '../lib/fishArt';
import { sound } from '../lib/audio';
import { createId, hslFromHex, hslToHex, randomBetween } from '../lib/utils';
import { normalizeFishName, randomFishName } from '../lib/names';
import { useGameStore } from '../store/useGameStore';
import type { FishEntity, FishTemplateId } from '../../shared/protocol';
import { Icon, type IconName } from './Icon';
import { TemplatePreview } from './TemplatePreview';

const SIZE = 640;
const MAX_HISTORY = 15;
const FREE_ID: FishTemplateId = 'free';
const TOOL_SIZES = { min: 6, max: 64 };

type Tool = 'brush' | 'fill' | 'eraser';
type BrushStyle = 'marker' | 'pencil' | 'crayon' | 'airbrush';
type BlendMode = 'source-over' | 'multiply' | 'screen' | 'overlay';

const BLEND_MODES: Array<{ id: BlendMode; label: string }> = [
  { id: 'source-over', label: 'Normal' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
];

const BRUSH_STYLES: Array<{ id: BrushStyle; label: string; icon: IconName }> = [
  { id: 'marker', label: 'Spidol', icon: 'marker' },
  { id: 'pencil', label: 'Pensil', icon: 'pencil' },
  { id: 'crayon', label: 'Krayon', icon: 'crayon' },
  { id: 'airbrush', label: 'Semprot', icon: 'spray' },
];

function traceStroke(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
}

function pointOnCurve(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * b.x + t * t * c.x,
    y: mt * mt * a.y + 2 * mt * t * b.y + t * t * c.y,
  };
}

function airbrushStamp(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const radius = Math.max(3, size * 0.9);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, rgba(color, 0.95));
  gradient.addColorStop(0.45, rgba(color, 0.4));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function paintDot(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  size: number,
  color: string,
  style: BrushStyle,
  blend: BlendMode,
) {
  ctx.save();
  ctx.globalCompositeOperation = blend;
  ctx.fillStyle = color;
  if (style === 'airbrush') {
    ctx.globalAlpha = 0.2;
    airbrushStamp(ctx, point.x, point.y, size, color);
    airbrushStamp(ctx, point.x, point.y, size * 0.7, color);
  } else if (style === 'pencil') {
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(1, size * 0.22), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(point.x + randomBetween(-size * 0.5, size * 0.5), point.y + randomBetween(-size * 0.5, size * 0.5), 1, 1);
    }
  } else if (style === 'crayon') {
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(point.x + randomBetween(-size * 0.35, size * 0.35), point.y + randomBetween(-size * 0.35, size * 0.35), size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.globalAlpha = 0.96;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(2, size / 2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintSegment(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  control: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
  color: string,
  style: BrushStyle,
  blend: BlendMode,
) {
  ctx.save();
  ctx.globalCompositeOperation = blend;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (style === 'airbrush') {
    const steps = Math.max(3, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(4, size * 0.35)));
    ctx.globalAlpha = 0.15;
    for (let i = 0; i <= steps; i++) {
      const point = pointOnCurve(from, control, to, i / steps);
      airbrushStamp(ctx, point.x, point.y, size, color);
    }
  } else if (style === 'pencil') {
    ctx.lineWidth = Math.max(1.2, size * 0.42);
    ctx.globalAlpha = 0.62;
    traceStroke(ctx, from, control, to);
    ctx.stroke();
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = Math.max(1, size * 0.18);
    ctx.save();
    ctx.translate(1.4, -1.2);
    traceStroke(ctx, from, control, to);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(-1.2, 1.6);
    traceStroke(ctx, from, control, to);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 2; i++) {
      const point = pointOnCurve(from, control, to, Math.random());
      ctx.fillRect(point.x + randomBetween(-3, 3), point.y + randomBetween(-3, 3), 1.2, 1.2);
    }
  } else if (style === 'crayon') {
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = Math.max(2, size * 0.9);
    traceStroke(ctx, from, control, to);
    ctx.stroke();
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = Math.max(1.5, size * 0.5);
    ctx.save();
    ctx.translate(2.4, 1.8);
    traceStroke(ctx, from, control, to);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.38;
    const dots = Math.max(3, Math.ceil(size / 8));
    for (let i = 0; i < dots; i++) {
      const point = pointOnCurve(from, control, to, Math.random());
      ctx.beginPath();
      ctx.arc(point.x + randomBetween(-size * 0.45, size * 0.45), point.y + randomBetween(-size * 0.45, size * 0.45), Math.max(0.8, size * 0.08), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.lineWidth = Math.max(2, size);
    ctx.globalAlpha = 0.97;
    traceStroke(ctx, from, control, to);
    ctx.stroke();
  }
  ctx.restore();
}

function eraseDot(ctx: CanvasRenderingContext2D, point: { x: number; y: number }, size: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(point.x, point.y, Math.max(2, size / 2), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function eraseSegment(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  control: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineWidth = Math.max(2, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  traceStroke(ctx, from, control, to);
  ctx.stroke();
  ctx.restore();
}

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

export function DrawingStudio() {
  const closeStudio = useGameStore((state) => state.closeStudio);
  const addFish = useGameStore((state) => state.addFish);
  const addToast = useGameStore((state) => state.addToast);
  const ownerId = useGameStore((state) => state.ownerId);

  const [templateId, setTemplateId] = useState<FishTemplateId>('goldfish');
  const template = TEMPLATE_MAP[templateId];
  const isFree = templateId === FREE_ID;
  const initialColor = '#F4A259';
  const initialHsl = hslFromHex(initialColor);
  const [color, setColor] = useState(initialColor);
  const [hue, setHue] = useState(initialHsl.h);
  const [saturation, setSaturation] = useState(initialHsl.s);
  const [lightness, setLightness] = useState(initialHsl.l);
  const [blend, setBlend] = useState<BlendMode>('source-over');
  const [tool, setTool] = useState<Tool>('brush');
  const [brushStyle, setBrushStyle] = useState<BrushStyle>('marker');
  const [brushSize, setBrushSize] = useState(30);
  const [name, setName] = useState(randomFishName);
  const [canUndo, setCanUndo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<HTMLCanvasElement | null>(null);
  const strokeRef = useRef<HTMLCanvasElement | null>(null);
  const compositeRef = useRef<HTMLCanvasElement | null>(null);
  const strokeBlendRef = useRef<BlendMode>('source-over');
  const strokeDirtyRef = useRef(false);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const maskDataRef = useRef<ImageData | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const drawingRef = useRef(false);
  const pointerRef = useRef<number | null>(null);
  const lastRef = useRef({ x: 0, y: 0 });
  const midRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ lastTime: 0, distance: 0 });
  const rafRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<FishTemplate>(template);
  const freeRef = useRef(isFree);
  const assetsRef = useRef<TemplateImages | null>(null);
  templateRef.current = template;
  freeRef.current = isFree;

  const paintContext = () => paintRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;
  const strokeContext = () => strokeRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;

  const clearStroke = useCallback(() => {
    const ctx = strokeContext();
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, SIZE, SIZE);
    }
    strokeDirtyRef.current = false;
  }, []);

  const composePaint = () => {
    const paint = paintRef.current;
    const stroke = strokeRef.current;
    const composite = compositeRef.current;
    if (!paint || !stroke || !composite || !strokeDirtyRef.current) return paint;
    const ctx = composite.getContext('2d');
    if (!ctx) return paint;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(paint, 0, 0);
    ctx.globalCompositeOperation = strokeBlendRef.current;
    ctx.drawImage(stroke, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return composite;
  };

  const flattenStroke = useCallback(() => {
    if (!strokeDirtyRef.current) return;
    const ctx = paintContext();
    const stroke = strokeRef.current;
    if (!ctx || !stroke) return;
    ctx.save();
    ctx.globalCompositeOperation = strokeBlendRef.current;
    ctx.globalAlpha = 1;
    ctx.drawImage(stroke, 0, 0);
    ctx.restore();
    clearStroke();
  }, [clearStroke]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const paint = paintRef.current;
    if (!canvas || !paint) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    const source = composePaint();
    if (!source) return;
    if (freeRef.current) {
      ctx.drawImage(source, 0, 0, SIZE, SIZE);
      return;
    }
    const assets = assetsRef.current;
    if (!assets) return;
    drawTemplateFish(ctx, assets, source, SIZE, SIZE);
  }, []);

  const scheduleRender = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      render();
    });
  }, [render]);

  const rebuildMask = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    const assets = assetsRef.current;
    if (freeRef.current || !assets) {
      maskDataRef.current = null;
      return;
    }
    ctx.drawImage(assets.shape, 0, 0, SIZE, SIZE);
    maskDataRef.current = ctx.getImageData(0, 0, SIZE, SIZE);
  }, []);

  const resetPaint = useCallback(() => {
    const ctx = paintContext();
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, SIZE, SIZE);
    clearStroke();
    historyRef.current = [];
    setCanUndo(false);
    scheduleRender();
  }, [scheduleRender, clearStroke]);

  useEffect(() => {
    const display = canvasRef.current;
    if (!display) return;
    display.width = SIZE;
    display.height = SIZE;

    const paint = document.createElement('canvas');
    paint.width = SIZE;
    paint.height = SIZE;
    paintRef.current = paint;

    const stroke = document.createElement('canvas');
    stroke.width = SIZE;
    stroke.height = SIZE;
    strokeRef.current = stroke;

    const composite = document.createElement('canvas');
    composite.width = SIZE;
    composite.height = SIZE;
    compositeRef.current = composite;

    const mask = document.createElement('canvas');
    mask.width = SIZE;
    mask.height = SIZE;
    maskRef.current = mask;

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      historyRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    assetsRef.current = null;
    const prepare = async () => {
      if (template.free) {
        freeRef.current = true;
        rebuildMask();
        resetPaint();
        render();
        return;
      }
      freeRef.current = false;
      try {
        const assets = await loadTemplateImages(template);
        if (cancelled || !assets) return;
        assetsRef.current = assets;
        rebuildMask();
        resetPaint();
        render();
      } catch (error) {
        console.warn('[studio] template image failed', error);
      }
    };
    void prepare();
    return () => {
      cancelled = true;
    };
  }, [template, rebuildMask, resetPaint, render]);

  const pushHistory = useCallback(() => {
    const ctx = paintContext();
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, SIZE, SIZE);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    setCanUndo(true);
  }, []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * SIZE,
      y: ((event.clientY - rect.top) / rect.height) * SIZE,
    };
  };

  const fill = useCallback((seedX: number, seedY: number, fillHex: string, free: boolean) => {
    const ctx = paintContext();
    if (!ctx) return false;
    const mask = free ? null : maskDataRef.current;
    if (!free && !mask) return false;
    const x = Math.floor(seedX);
    const y = Math.floor(seedY);
    if (x < 1 || y < 1 || x >= SIZE - 1 || y >= SIZE - 1) return false;
    if (mask && mask.data[(y * SIZE + x) * 4 + 3] < 80) return false;

    const image = ctx.getImageData(0, 0, SIZE, SIZE);
    const data = image.data;
    const seedIndex = (y * SIZE + x) * 4;
    const target = [data[seedIndex], data[seedIndex + 1], data[seedIndex + 2], data[seedIndex + 3]];
    const fillColor = hexToRgba(fillHex);
    const tolerance = 48;
    if (
      Math.abs(target[0] - fillColor[0]) < 3 &&
      Math.abs(target[1] - fillColor[1]) < 3 &&
      Math.abs(target[2] - fillColor[2]) < 3 &&
      Math.abs(target[3] - fillColor[3]) < 3
    ) {
      return false;
    }

    const matches = (index: number) => {
      if (mask && mask.data[index + 3] < 70) return false;
      return (
        Math.abs(data[index] - target[0]) <= tolerance &&
        Math.abs(data[index + 1] - target[1]) <= tolerance &&
        Math.abs(data[index + 2] - target[2]) <= tolerance &&
        Math.abs(data[index + 3] - target[3]) <= tolerance
      );
    };

    const stack: number[] = [y * SIZE + x];
    const visited = new Uint8Array(SIZE * SIZE);
    let painted = 0;
    let touchesEdge = false;
    while (stack.length > 0) {
      const index = stack.pop() as number;
      const py = (index / SIZE) | 0;
      const px = index % SIZE;
      if (visited[index]) continue;
      let left = px;
      while (left >= 0 && matches((py * SIZE + left) * 4)) left--;
      left++;
      let spanUp = false;
      let spanDown = false;
      for (let cx = left; cx < SIZE && matches((py * SIZE + cx) * 4); cx++) {
        const pixel = py * SIZE + cx;
        if (visited[pixel]) break;
        visited[pixel] = 1;
        const pi = pixel * 4;
        data[pi] = fillColor[0];
        data[pi + 1] = fillColor[1];
        data[pi + 2] = fillColor[2];
        data[pi + 3] = fillColor[3];
        painted++;
        if (cx === 0 || py === 0 || cx === SIZE - 1 || py === SIZE - 1) touchesEdge = true;

        if (py > 0) {
          const up = (py - 1) * SIZE + cx;
          const upMatch = !visited[up] && matches(up * 4);
          if (upMatch && !spanUp) {
            stack.push(up);
            spanUp = true;
          } else if (!upMatch) {
            spanUp = false;
          }
        }
        if (py < SIZE - 1) {
          const down = (py + 1) * SIZE + cx;
          const downMatch = !visited[down] && matches(down * 4);
          if (downMatch && !spanDown) {
            stack.push(down);
            spanDown = true;
          } else if (!downMatch) {
            spanDown = false;
          }
        }
      }
    }
    if (painted === 0) return false;
    if (free && touchesEdge) return false;
    ctx.putImageData(image, 0, 0);
    return true;
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (saving) return;
    event.preventDefault();
    sound.unlock();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    drawingRef.current = true;
    const point = pointFromEvent(event);
    lastRef.current = point;
    midRef.current = point;
    velocityRef.current = { lastTime: performance.now(), distance: 0 };
    const ctx = paintContext();
    if (!ctx) return;

    if (tool === 'fill') {
      pushHistory();
      if (!fill(point.x, point.y, color, isFree)) {
        historyRef.current.pop();
        setCanUndo(historyRef.current.length > 0);
      } else {
        sound.chime('soft');
      }
      drawingRef.current = false;
      pointerRef.current = null;
      scheduleRender();
      return;
    }

    pushHistory();
    strokeBlendRef.current = blend;
    if (tool === 'eraser') {
      eraseDot(ctx, point, brushSize);
    } else {
      const sctx = strokeContext();
      if (!sctx) return;
      clearStroke();
      paintDot(sctx, point, brushSize, color, brushStyle, 'source-over');
      strokeDirtyRef.current = true;
    }
    sound.brushStart();
    sound.brushMove(0.2);
    scheduleRender();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (canvas && stage && cursorRef.current) {
      const rect = canvas.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const cursorSize = (brushSize / SIZE) * rect.width;
      cursorRef.current.style.width = `${cursorSize}px`;
      cursorRef.current.style.height = `${cursorSize}px`;
      cursorRef.current.style.transform = `translate(${event.clientX - stageRect.left - cursorSize / 2}px, ${
        event.clientY - stageRect.top - cursorSize / 2
      }px)`;
      cursorRef.current.style.opacity = tool === 'fill' ? '0' : '1';
    }

    if (!drawingRef.current || pointerRef.current !== event.pointerId || tool === 'fill') return;
    const point = pointFromEvent(event);
    const last = lastRef.current;
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    if (distance < 0.6) return;
    const ctx = paintContext();
    if (!ctx) return;
    const mid = { x: (last.x + point.x) / 2, y: (last.y + point.y) / 2 };
    if (tool === 'eraser') {
      eraseSegment(ctx, midRef.current, last, mid, brushSize);
    } else {
      const sctx = strokeContext();
      if (!sctx) return;
      paintSegment(sctx, midRef.current, last, mid, brushSize, color, brushStyle, 'source-over');
      strokeDirtyRef.current = true;
    }
    midRef.current = mid;
    lastRef.current = point;

    const now = performance.now();
    const elapsed = Math.max(1, now - velocityRef.current.lastTime);
    velocityRef.current.lastTime = now;
    velocityRef.current.distance = distance;
    sound.brushMove(Math.min(1, distance / Math.max(8, elapsed * 0.55)));
    scheduleRender();
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    if (drawingRef.current && tool !== 'fill') {
      const ctx = paintContext();
      const sctx = strokeContext();
      if (ctx) {
        if (tool === 'eraser') {
          eraseSegment(ctx, midRef.current, lastRef.current, lastRef.current, brushSize);
        } else if (sctx) {
          paintSegment(sctx, midRef.current, lastRef.current, lastRef.current, brushSize, color, brushStyle, 'source-over');
          strokeDirtyRef.current = true;
          flattenStroke();
        }
        scheduleRender();
      }
      sound.brushStop();
    }
    drawingRef.current = false;
    pointerRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const undo = () => {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    const ctx = paintContext();
    if (!ctx) return;
    ctx.putImageData(snapshot, 0, 0);
    setCanUndo(historyRef.current.length > 0);
    sound.chime('soft');
    scheduleRender();
  };

  const reset = () => {
    pushHistory();
    const ctx = paintContext();
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, SIZE, SIZE);
    sound.splash();
    scheduleRender();
  };

  const changeTemplate = (id: FishTemplateId) => {
    if (id === templateId) return;
    setTemplateId(id);
    sound.chime('soft');
  };

  const chooseColor = (next: string) => {
    const hsl = hslFromHex(next);
    setColor(next);
    setHue(hsl.h);
    setSaturation(hsl.s);
    setLightness(hsl.l);
    if (tool === 'eraser') setTool('brush');
    sound.chime('soft');
  };

  const rollName = () => {
    setName(randomFishName());
    sound.chime('soft');
  };

  const finish = () => {
    if (saving) return;
    const paint = paintRef.current;
    if (!paint) return;
    setSaving(true);
    sound.chime('bright');
    window.setTimeout(() => {
      try {
        const assets = assetsRef.current;
        const exported = isFree
          ? exportFreeFish(paint)
          : assets
            ? exportTemplateFish(assets, paint)
            : { dataUrl: '', bytes: 0 };
        if (!exported.dataUrl || !exported.dataUrl.startsWith('data:image/')) {
          addToast('Gambar ikanmu dulu ya, baru dilepas!', 'warn');
          setSaving(false);
          return;
        }
        const side = Math.random() > 0.5;
        const fish: FishEntity = {
          id: createId(),
          ownerId,
          name: normalizeFishName(name),
          templateId: templateRef.current.id,
          textureData: exported.dataUrl,
          createdAt: Date.now(),
          transform: {
            x: side ? 0.14 : 0.86,
            y: randomBetween(0.3, 0.66),
            targetX: side ? randomBetween(0.3, 0.8) : randomBetween(0.2, 0.7),
            targetY: randomBetween(0.3, 0.7),
            speed: 0.45,
            facing: side ? 1 : -1,
          },
          state: 'WANDER',
        };
        addFish(fish);
      } catch (error) {
        console.error(error);
        addToast('Ups, ikan belum berhasil dilepas. Coba sekali lagi.', 'warn');
      } finally {
        setSaving(false);
      }
    }, 20);
  };

  const requestClose = () => {
    if (canUndo) setConfirmClose(true);
    else closeStudio();
  };

  const cursorColor = useMemo(() => (tool === 'eraser' ? '#ffffff' : color), [tool, color]);

  return (
    <div
      className="modal-backdrop studio-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section className="studio-panel" role="dialog" aria-modal="true" aria-label="Studio menggambar ikan">
        <header className="studio-header">
          <button type="button" className="round-btn studio-back" onClick={requestClose} aria-label="Tutup studio">
            <Icon name="back" size={24} />
          </button>
          <div className="studio-heading">
            <h2>Gambar Ikan</h2>
            <p>{isFree ? 'Kanvas bebas — gambar sesukamu' : `Stiker ${template.label}`}</p>
          </div>
          <label className="name-pill">
            <input
              value={name}
              maxLength={20}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setName((current) => normalizeFishName(current))}
              aria-label="Nama ikan"
            />
            <button type="button" onClick={rollName} className="dice-btn" aria-label="Acak nama ikan">
              <Icon name="sparkles" size={19} />
            </button>
          </label>
          <button type="button" className="btn btn-primary finish-top" onClick={finish} disabled={saving}>
            <Icon name="wave" size={20} />
            <span>{saving ? 'Sebentar…' : 'Lepaskan!'}</span>
          </button>
        </header>

        <div className="studio-body">
          <div className="canvas-column">
            <div className={`canvas-stage ${isFree ? 'free-mode' : ''}`} ref={stageRef}>
              {isFree && (
                <svg className="free-guide" viewBox="0 0 1024 1024" aria-hidden="true">
                  <path
                    d="M 300 512 C 360 420 500 380 640 400 C 740 415 812 460 858 512 C 812 565 740 610 640 620 C 500 640 360 600 300 512 Z M 312 512 C 250 470 200 440 150 430 C 190 480 190 540 150 594 C 205 580 260 580 312 600"
                    fill="none"
                    stroke="#d9a06a"
                    strokeWidth="10"
                    strokeDasharray="20 22"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <canvas
                ref={canvasRef}
                className="drawing-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
                onPointerLeave={() => {
                  if (cursorRef.current) cursorRef.current.style.opacity = '0';
                }}
                onPointerEnter={() => {
                  if (cursorRef.current) cursorRef.current.style.opacity = tool === 'fill' ? '0' : '1';
                }}
              />
              <div ref={cursorRef} className="brush-cursor" style={{ borderColor: cursorColor, opacity: 0 }} aria-hidden="true" />
              {isFree && <span className="free-badge">✏️ Gambar bebas</span>}
            </div>
            <p className="canvas-note">
              {isFree ? 'Semua coretanmu jadi stiker ikan.' : 'Warnai sesukamu — garis tetap rapi.'}
            </p>
          </div>

          <aside className="studio-tools">
            <section className="tool-block">
              <div className="block-head">
                <h3>Pilih Ikan</h3>
                <span>{TEMPLATES.length - 1} stiker + bebas</span>
              </div>
              <div className="template-strip">
                {TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`template-option ${item.id === templateId ? 'selected' : ''}`}
                    onClick={() => changeTemplate(item.id)}
                    aria-pressed={item.id === templateId}
                  >
                    {item.free ? (
                      <span className="free-sticker">
                        <Icon name="pencil" size={30} />
                      </span>
                    ) : (
                      <TemplatePreview template={item} size={56} />
                    )}
                    <span>{item.free ? 'Bebas' : item.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="tool-block">
              <div className="block-head">
                <h3>Alat</h3>
                <span>{tool === 'brush' ? BRUSH_STYLES.find((style) => style.id === brushStyle)?.label : tool === 'fill' ? 'Ember' : 'Penghapus'}</span>
              </div>
              <div className="tool-row">
                <button type="button" className={`tool-chip ${tool === 'brush' ? 'active' : ''}`} onClick={() => setTool('brush')} aria-pressed={tool === 'brush'}>
                  <Icon name="marker" size={22} />
                  <span>Kuas</span>
                </button>
                <button type="button" className={`tool-chip ${tool === 'fill' ? 'active' : ''}`} onClick={() => setTool('fill')} aria-pressed={tool === 'fill'}>
                  <Icon name="fill" size={22} />
                  <span>Ember</span>
                </button>
                <button type="button" className={`tool-chip ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} aria-pressed={tool === 'eraser'}>
                  <Icon name="eraser" size={22} />
                  <span>Hapus</span>
                </button>
                <button type="button" className="tool-chip" onClick={undo} disabled={!canUndo}>
                  <Icon name="undo" size={22} />
                  <span>Undo</span>
                </button>
                <button type="button" className="tool-chip soft-danger" onClick={reset}>
                  <Icon name="trash" size={22} />
                  <span>Reset</span>
                </button>
              </div>

              {tool === 'brush' && (
                <div className="brush-style-row">
                  {BRUSH_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      className={`brush-chip ${brushStyle === style.id ? 'active' : ''}`}
                      onClick={() => setBrushStyle(style.id)}
                      aria-pressed={brushStyle === style.id}
                    >
                      <Icon name={style.icon} size={18} />
                      <span>{style.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="tool-block">
              <div className="block-head">
                <h3>Warna</h3>
                <span className="color-preview" style={{ background: color }} />
              </div>
              <div className="hue-wrap">
                <span>Hue</span>
                <input
                  aria-label="Hue warna"
                  className="hue-slider"
                  type="range"
                  min={0}
                  max={359}
                  value={hue}
                  onChange={(event) => {
                    const nextHue = Number(event.target.value);
                    setHue(nextHue);
                    setColor(hslToHex(nextHue, saturation, lightness));
                    setTool((current) => (current === 'eraser' ? 'brush' : current));
                  }}
                />
              </div>
              <div className="hue-wrap">
                <span>Sat.</span>
                <input
                  aria-label="Saturasi warna"
                  className="sat-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={saturation}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setSaturation(next);
                    setColor(hslToHex(hue, next, lightness));
                  }}
                />
              </div>
              <div className="hue-wrap">
                <span>Terang</span>
                <input
                  aria-label="Kecerahan warna"
                  className="light-slider"
                  type="range"
                  min={18}
                  max={92}
                  value={lightness}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setLightness(next);
                    setColor(hslToHex(hue, saturation, next));
                  }}
                />
              </div>
              <div className="color-readout">
                <span className="color-dot" style={{ background: color }} />
                <strong>{color.toUpperCase()}</strong>
                <span>
                  RGB {hexToRgb(color).join(' · ')}
                </span>
              </div>
              <div className="blend-row">
                <span>Blend</span>
                {BLEND_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`blend-chip ${blend === mode.id ? 'active' : ''}`}
                    onClick={() => setBlend(mode.id)}
                    aria-pressed={blend === mode.id}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <div className="swatch-row">
                {STUDIO_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.color}
                    type="button"
                    className={`swatch ${color.toLowerCase() === swatch.color.toLowerCase() ? 'active' : ''} ${swatch.name === 'Putih' ? 'light' : ''}`}
                    style={{ background: swatch.color }}
                    onClick={() => chooseColor(swatch.color)}
                    aria-label={`Warna ${swatch.name}`}
                    title={`${swatch.name} ${swatch.color}`}
                  />
                ))}
              </div>
              <div className="size-wrap">
                <span>Ukuran</span>
                <input
                  aria-label="Ukuran kuas"
                  className="size-slider"
                  type="range"
                  min={TOOL_SIZES.min}
                  max={TOOL_SIZES.max}
                  value={brushSize}
                  onChange={(event) => setBrushSize(Number(event.target.value))}
                />
                <strong>{brushSize}</strong>
              </div>
            </section>

            <div className="tool-tip">
              <span className="tip-bow">
                <Icon name="bow" size={16} />
              </span>
              <p>
                <strong>Jadi stiker!</strong>
                {isFree ? ' Gambarmu dapat pinggiran putih lucu.' : ' Setiap ikan punya pinggiran putih.'}
              </p>
            </div>
          </aside>
        </div>

        <footer className="studio-mobile-footer">
          <button type="button" className="btn btn-primary" onClick={finish} disabled={saving}>
            <Icon name="wave" size={20} />
            <span>{saving ? 'Sebentar…' : 'Lepaskan ke Laut!'}</span>
          </button>
        </footer>

        {confirmClose && (
          <div className="confirm-layer">
            <div className="confirm-card">
              <div className="confirm-emoji">🐟</div>
              <h3>Tinggalkan gambar?</h3>
              <p>Gambar yang belum dilepas akan hilang.</p>
              <div className="confirm-actions">
                <button type="button" className="btn btn-soft" onClick={() => setConfirmClose(false)}>
                  Lanjut gambar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    setConfirmClose(false);
                    closeStudio();
                  }}
                >
                  Keluar
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
