import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FishTemplate } from '../data/templates';
import { PALETTE, TEMPLATES, TEMPLATE_MAP } from '../data/templates';
import { drawFishArt, exportFishTexture, templatePath } from '../lib/fishArt';
import { sound } from '../lib/audio';
import { createId, randomBetween } from '../lib/utils';
import { normalizeFishName, randomFishName } from '../lib/names';
import { useGameStore } from '../store/useGameStore';
import type { FishEntity, FishTemplateId } from '../../shared/protocol';
import { Icon } from './Icon';
import { TemplatePreview } from './TemplatePreview';

const SIZE = 640;
const MAX_HISTORY = 15;
const BRUSH_SIZES = [
  { label: 'Tipis', value: 14 },
  { label: 'Sedang', value: 30 },
  { label: 'Tebal', value: 54 },
];

type Tool = 'brush' | 'fill' | 'eraser';

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

  const [templateId, setTemplateId] = useState<FishTemplateId>(() => TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)].id);
  const template = TEMPLATE_MAP[templateId];
  const [color, setColor] = useState<string>(PALETTE[0].color);
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(30);
  const [name, setName] = useState(randomFishName);
  const [canUndo, setCanUndo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<HTMLCanvasElement | null>(null);
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
  templateRef.current = template;

  const paintContext = () =>
    paintRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const paint = paintRef.current;
    if (!canvas || !paint) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawFishArt(ctx, templateRef.current, SIZE, {
      paint,
      paintSize: SIZE,
      withShading: true,
      withOutline: true,
      withEye: true,
    });
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
    ctx.save();
    const scale = SIZE / 1024;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.fill(templatePath(templateRef.current));
    ctx.restore();
    maskDataRef.current = ctx.getImageData(0, 0, SIZE, SIZE);
  }, []);

  const resetPaint = useCallback(() => {
    const ctx = paintContext();
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, SIZE, SIZE);
    historyRef.current = [];
    setCanUndo(false);
    scheduleRender();
  }, [scheduleRender]);

  // One-time canvas setup.
  useEffect(() => {
    const display = canvasRef.current;
    if (!display) return;
    display.width = SIZE;
    display.height = SIZE;

    const paint = document.createElement('canvas');
    paint.width = SIZE;
    paint.height = SIZE;
    paintRef.current = paint;

    const mask = document.createElement('canvas');
    mask.width = SIZE;
    mask.height = SIZE;
    maskRef.current = mask;

    templateRef.current = template;
    rebuildMask();
    resetPaint();
    render();
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      historyRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Template changes clear the canvas, like turning over a fresh cut-out.
  const firstTemplate = useRef(true);
  useEffect(() => {
    if (firstTemplate.current) {
      firstTemplate.current = false;
      return;
    }
    templateRef.current = template;
    rebuildMask();
    resetPaint();
  }, [template, rebuildMask, resetPaint]);

  const pushHistory = useCallback(() => {
    const ctx = paintContext();
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, SIZE, SIZE);
    const history = historyRef.current;
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
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

  const configureBrush = useCallback(
    (ctx: CanvasRenderingContext2D, currentTool: Tool, currentColor: string, size: number) => {
      ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = currentTool === 'eraser' ? '#000000' : currentColor;
      ctx.fillStyle = currentTool === 'eraser' ? '#000000' : currentColor;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    },
    [],
  );

  const applyFloodFill = useCallback(
    (seedX: number, seedY: number, fillHex: string) => {
      const ctx = paintContext();
      const mask = maskDataRef.current;
      if (!ctx || !mask) return false;
      const x = Math.floor(seedX);
      const y = Math.floor(seedY);
      if (x < 1 || y < 1 || x >= SIZE - 1 || y >= SIZE - 1) return false;
      const maskAlpha = mask.data[(y * SIZE + x) * 4 + 3];
      if (maskAlpha < 80) return false;

      const image = ctx.getImageData(0, 0, SIZE, SIZE);
      const data = image.data;
      const seedIndex = (y * SIZE + x) * 4;
      const target = [data[seedIndex], data[seedIndex + 1], data[seedIndex + 2], data[seedIndex + 3]];
      const fill = hexToRgba(fillHex);
      const tolerance = 46;
      if (
        Math.abs(target[0] - fill[0]) < 3 &&
        Math.abs(target[1] - fill[1]) < 3 &&
        Math.abs(target[2] - fill[2]) < 3 &&
        Math.abs(target[3] - fill[3]) < 3
      ) {
        return false;
      }

      const matches = (index: number) => {
        if (mask.data[index + 3] < 70) return false;
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
          data[pi] = fill[0];
          data[pi + 1] = fill[1];
          data[pi + 2] = fill[2];
          data[pi + 3] = fill[3];
          painted++;

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

      if (painted > 0) {
        ctx.putImageData(image, 0, 0);
        return true;
      }
      return false;
    },
    [],
  );

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
      const filled = applyFloodFill(point.x, point.y, color);
      if (!filled) {
        // Fill outside the fish is harmless: silently keep the artwork.
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
    configureBrush(ctx, tool, color, brushSize);
    ctx.beginPath();
    ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    sound.brushStart();
    sound.brushMove(0.2);
    scheduleRender();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // Brush ring cursor.
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (canvas && stage && cursorRef.current) {
      const rect = canvas.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const dprSize = (brushSize / SIZE) * rect.width;
      cursorRef.current.style.width = `${dprSize}px`;
      cursorRef.current.style.height = `${dprSize}px`;
      cursorRef.current.style.transform = `translate(${event.clientX - stageRect.left - dprSize / 2}px, ${
        event.clientY - stageRect.top - dprSize / 2
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
    configureBrush(ctx, tool, color, brushSize);
    const mid = { x: (last.x + point.x) / 2, y: (last.y + point.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(midRef.current.x, midRef.current.y);
    ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
    ctx.stroke();
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
      if (ctx) {
        configureBrush(ctx, tool, color, brushSize);
        ctx.beginPath();
        ctx.moveTo(midRef.current.x, midRef.current.y);
        ctx.quadraticCurveTo(lastRef.current.x, lastRef.current.y, lastRef.current.x, lastRef.current.y);
        ctx.stroke();
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
    ctx.clearRect(0, 0, SIZE, SIZE);
    sound.splash();
    scheduleRender();
  };

  const changeTemplate = (id: FishTemplateId) => {
    if (id === templateId) return;
    setTemplateId(id);
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
        const exported = exportFishTexture(templateRef.current, paint);
        if (!exported.dataUrl || !exported.dataUrl.startsWith('data:image/')) {
          addToast('Gambar belum bisa disimpan. Coba lagi ya.', 'warn');
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
            x: side ? 0.12 : 0.88,
            y: randomBetween(0.28, 0.68),
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
    if (canUndo) {
      setConfirmClose(true);
    } else {
      closeStudio();
    }
  };

  const cursorColor = useMemo(() => (tool === 'eraser' ? '#ffffff' : color), [tool, color]);

  return (
    <div
      className="modal-backdrop studio-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section className="glass-panel studio-panel" role="dialog" aria-modal="true" aria-label="Studio menggambar ikan">
        <header className="studio-header">
          <button type="button" className="glass-btn icon-btn studio-back" onClick={requestClose} aria-label="Tutup studio">
            <Icon name="back" size={26} />
          </button>
          <div className="studio-heading">
            <h2>
              Studio <span>Gambar</span>
            </h2>
            <p>Coret sepuasnya, ikanmu selalu rapi.</p>
          </div>
          <label className="name-pill">
            <span>Nama</span>
            <input
              value={name}
              maxLength={20}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setName((current) => normalizeFishName(current))}
              aria-label="Nama ikan"
            />
            <button type="button" onClick={rollName} className="dice-btn" aria-label="Acak nama ikan">
              <Icon name="dice" size={22} />
            </button>
          </label>
          <button type="button" className="glass-btn primary finish-top" onClick={finish} disabled={saving}>
            <Icon name="wave" size={22} />
            <span>{saving ? 'Menyiapkan…' : 'Lepaskan ke Laut!'}</span>
          </button>
        </header>

        <div className="studio-body">
          <div className="canvas-column">
            <div className="canvas-stage" ref={stageRef}>
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
              <div
                ref={cursorRef}
                className="brush-cursor"
                style={{ borderColor: cursorColor, opacity: 0 }}
                aria-hidden="true"
              />
              <div className="canvas-badge">
                <Icon name="sparkles" size={16} />
                <span>Otomatis rapi di dalam garis</span>
              </div>
            </div>
            <div className="template-caption">
              <span>{template.emoji}</span>
              <strong>{template.label}</strong>
              <span className="caption-divider" />
              <span>Ganti bentuk akan mengosongkan warna</span>
            </div>
          </div>

          <aside className="studio-tools">
            <section className="tool-section">
              <div className="tool-heading">
                <h3>Bentuk Ikan</h3>
                <span>8 siluet</span>
              </div>
              <div className="template-grid">
                {TEMPLATES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`template-option ${item.id === templateId ? 'selected' : ''}`}
                    onClick={() => changeTemplate(item.id)}
                    aria-pressed={item.id === templateId}
                  >
                    <TemplatePreview template={item} size={58} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="tool-section">
              <div className="tool-heading">
                <h3>Warna</h3>
                <span>16 warna cerah</span>
              </div>
              <div className="palette-grid">
                {PALETTE.map((item) => (
                  <button
                    key={item.color}
                    type="button"
                    className={`swatch ${color === item.color && tool !== 'eraser' ? 'active' : ''} ${
                      item.color === '#FFFFFF' ? 'light' : ''
                    }`}
                    style={{ background: item.color }}
                    onClick={() => {
                      setColor(item.color);
                      if (tool === 'eraser') setTool('brush');
                      sound.chime('soft');
                    }}
                    aria-label={`Warna ${item.name}`}
                    title={item.name}
                  >
                    <span className="swatch-inner" />
                  </button>
                ))}
              </div>
            </section>

            <section className="tool-section">
              <div className="tool-heading">
                <h3>Alat</h3>
                <span>Sentuh & gambar</span>
              </div>
              <div className="tool-row">
                <button
                  type="button"
                  className={`tool-button ${tool === 'brush' ? 'active' : ''}`}
                  onClick={() => {
                    setTool('brush');
                    sound.chime('soft');
                  }}
                  aria-pressed={tool === 'brush'}
                >
                  <Icon name="brush" size={24} />
                  <span>Kuas</span>
                </button>
                <button
                  type="button"
                  className={`tool-button ${tool === 'fill' ? 'active' : ''}`}
                  onClick={() => {
                    setTool('fill');
                    sound.chime('soft');
                  }}
                  aria-pressed={tool === 'fill'}
                >
                  <Icon name="fill" size={24} />
                  <span>Ember</span>
                </button>
                <button
                  type="button"
                  className={`tool-button ${tool === 'eraser' ? 'active' : ''}`}
                  onClick={() => {
                    setTool('eraser');
                    sound.chime('soft');
                  }}
                  aria-pressed={tool === 'eraser'}
                >
                  <Icon name="eraser" size={24} />
                  <span>Hapus</span>
                </button>
                <button type="button" className="tool-button" onClick={undo} disabled={!canUndo} aria-label="Undo">
                  <Icon name="undo" size={24} />
                  <span>Undo</span>
                </button>
                <button type="button" className="tool-button danger" onClick={reset} aria-label="Reset gambar">
                  <Icon name="trash" size={24} />
                  <span>Reset</span>
                </button>
              </div>

              <div className="brush-row">
                <span className="brush-label">Ukuran kuas</span>
                <div className="brush-sizes">
                  {BRUSH_SIZES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`brush-size ${brushSize === item.value ? 'active' : ''}`}
                      onClick={() => {
                        setBrushSize(item.value);
                        setTool((current) => (current === 'eraser' ? 'eraser' : 'brush'));
                        sound.chime('soft');
                      }}
                      aria-pressed={brushSize === item.value}
                      aria-label={`Kuas ${item.label}`}
                    >
                      <span style={{ width: 6 + item.value / 4, height: 6 + item.value / 4 }} />
                      <small>{item.label}</small>
                    </button>
                  ))}
                </div>
              </div>
            </section>

          </aside>
        </div>

        <footer className="studio-mobile-footer">
          <button type="button" className="glass-btn primary" onClick={finish} disabled={saving}>
            <Icon name="wave" size={22} />
            <span>{saving ? 'Menyiapkan…' : 'Lepaskan ke Laut!'}</span>
          </button>
        </footer>

        {confirmClose && (
          <div className="confirm-layer">
            <div className="glass-panel confirm-card">
              <div className="confirm-emoji">🐟</div>
              <h3>Tinggalkan gambar ini?</h3>
              <p>Gambar yang belum dilepas akan hilang.</p>
              <div className="confirm-actions">
                <button type="button" className="glass-btn" onClick={() => setConfirmClose(false)}>
                  Lanjut <Icon name="brush" size={18} />
                </button>
                <button
                  type="button"
                  className="glass-btn danger"
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
