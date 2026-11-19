const INDONESIAN_ZONES = new Set([
  'Asia/Jakarta',
  'Asia/Pontianak',
  'Asia/Makassar',
  'Asia/Jayapura',
]);

export type DayPeriod = 'pagi' | 'siang' | 'sore' | 'malam';

export interface IndonesiaTime {
  period: DayPeriod;
  label: string;
  zoneLabel: string;
  hour: number;
  minute: number;
  /** Multiplicative tint applied to the underwater photograph. */
  tint: number;
  warm: [number, number, number];
  warmAlpha: number;
  night: number;
  ray: number;
}

interface Keyframe {
  hour: number;
  tint: [number, number, number];
  warm: [number, number, number];
  warmAlpha: number;
  night: number;
  ray: number;
}

// A continuous palette across the day. Adjacent keyframes are interpolated so
// the ocean shifts smoothly instead of snapping at a period boundary.
const KEYFRAMES: Keyframe[] = [
  { hour: 0, tint: [0.52, 0.6, 0.85], warm: [22, 38, 90], warmAlpha: 0.26, night: 0.9, ray: 0.32 },
  { hour: 4.5, tint: [0.56, 0.64, 0.88], warm: [30, 50, 100], warmAlpha: 0.24, night: 0.72, ray: 0.4 },
  { hour: 6, tint: [1, 0.86, 0.7], warm: [255, 145, 82], warmAlpha: 0.32, night: 0.12, ray: 0.62 },
  { hour: 8, tint: [1, 0.96, 0.86], warm: [255, 205, 150], warmAlpha: 0.16, night: 0, ray: 0.85 },
  { hour: 11, tint: [1, 1, 1], warm: [255, 235, 205], warmAlpha: 0.03, night: 0, ray: 1 },
  { hour: 15, tint: [1, 0.99, 0.95], warm: [255, 225, 175], warmAlpha: 0.05, night: 0, ray: 1 },
  { hour: 16.5, tint: [1, 0.84, 0.68], warm: [255, 135, 60], warmAlpha: 0.32, night: 0.02, ray: 0.8 },
  { hour: 18.2, tint: [0.92, 0.68, 0.64], warm: [255, 80, 50], warmAlpha: 0.42, night: 0.3, ray: 0.55 },
  { hour: 19.5, tint: [0.58, 0.65, 0.88], warm: [30, 45, 105], warmAlpha: 0.28, night: 0.78, ray: 0.4 },
  { hour: 24, tint: [0.52, 0.6, 0.85], warm: [22, 38, 90], warmAlpha: 0.26, night: 0.9, ray: 0.32 },
];

function currentZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && INDONESIAN_ZONES.has(zone)) return zone;
  } catch {
    // fall through to WIB
  }
  return 'Asia/Jakarta';
}

function countryTime(now: Date): { hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: currentZone(),
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
    return { hour, minute };
  } catch {
    return { hour: now.getHours(), minute: now.getMinutes() };
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
}

function periodFor(hour: number): DayPeriod {
  if (hour >= 5 && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 16) return 'siang';
  if (hour >= 16 && hour < 18.5) return 'sore';
  return 'malam';
}

const LABELS: Record<DayPeriod, string> = {
  pagi: 'Pagi',
  siang: 'Siang',
  sore: 'Sore',
  malam: 'Malam',
};

export function getIndonesiaTime(now = new Date()): IndonesiaTime {
  const { hour, minute } = countryTime(now);
  const hourFloat = hour + minute / 60;
  let from = KEYFRAMES[0];
  let to = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (hourFloat >= KEYFRAMES[i].hour && hourFloat <= KEYFRAMES[i + 1].hour) {
      from = KEYFRAMES[i];
      to = KEYFRAMES[i + 1];
      break;
    }
  }
  const span = Math.max(0.001, to.hour - from.hour);
  const t = smooth(Math.min(1, Math.max(0, (hourFloat - from.hour) / span)));
  const tint = mixColor(
    from.tint.map((v) => Math.round(v * 255)) as [number, number, number],
    to.tint.map((v) => Math.round(v * 255)) as [number, number, number],
    t,
  );
  const period = periodFor(hourFloat);
  const zone = currentZone();
  const zoneLabel = zone === 'Asia/Jayapura' ? 'WIT' : zone === 'Asia/Makassar' ? 'WITA' : 'WIB';
  return {
    period,
    label: LABELS[period],
    zoneLabel,
    hour,
    minute,
    tint: (tint[0] << 16) | (tint[1] << 8) | tint[2],
    warm: mixColor(from.warm, to.warm, t),
    warmAlpha: lerp(from.warmAlpha, to.warmAlpha, t),
    night: lerp(from.night, to.night, t),
    ray: lerp(from.ray, to.ray, t),
  };
}
