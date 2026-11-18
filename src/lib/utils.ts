export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Tiny value-noise 1D-ish helper used by the swimmer's wander steering. */
export function smoothNoise(seed: number, time: number): number {
  const x = time * 0.45 + seed * 12.9898;
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
}

export function hslToHex(hue: number, saturation = 88, lightness = 64): string {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = h / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (section < 1) [r, g, b] = [chroma, x, 0];
  else if (section < 2) [r, g, b] = [x, chroma, 0];
  else if (section < 3) [r, g, b] = [0, chroma, x];
  else if (section < 4) [r, g, b] = [0, x, chroma];
  else if (section < 5) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];
  const m = l - chroma / 2;
  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hueFromHex(hex: string): number {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 340;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return Math.round((hue * 60 + 360) % 360);
}

export function formatDateID(date = new Date()): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
