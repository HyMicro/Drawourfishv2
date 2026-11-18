import type { FishTemplateId } from '../../shared/protocol';

export interface FishTemplate {
  id: FishTemplateId;
  label: string;
  emoji: string;
  /** 640px white alpha silhouette. */
  shapeUrl: string;
  /** 640px rim/outline/eye overlay (transparent body). */
  detailsUrl: string;
  /** Colorized 384px square texture for resident AI fish. */
  textureUrl: string;
  /** Colorized 256px square preview for the picker. */
  thumbUrl: string;
  accent: string;
  motion: 'rope' | 'drift';
  size: number;
  free?: boolean;
}

const BASE = '/fish';

export const TEMPLATES: FishTemplate[] = [
  {
    id: 'goldfish',
    label: 'Goldfish',
    emoji: '🐟',
    shapeUrl: `${BASE}/goldfish-shape.webp`,
    detailsUrl: `${BASE}/goldfish-details.webp`,
    textureUrl: `${BASE}/goldfish-texture.webp`,
    thumbUrl: `${BASE}/goldfish-thumb.webp`,
    accent: '#F2A35C',
    motion: 'rope',
    size: 1.02,
  },
  {
    id: 'puffer',
    label: 'Pufferfish',
    emoji: '🐡',
    shapeUrl: `${BASE}/puffer-shape.webp`,
    detailsUrl: `${BASE}/puffer-details.webp`,
    textureUrl: `${BASE}/puffer-texture.webp`,
    thumbUrl: `${BASE}/puffer-thumb.webp`,
    accent: '#F4C95D',
    motion: 'rope',
    size: 0.92,
  },
  {
    id: 'bubblefish',
    label: 'Bubblefish',
    emoji: '🐠',
    shapeUrl: `${BASE}/bubblefish-shape.webp`,
    detailsUrl: `${BASE}/bubblefish-details.webp`,
    textureUrl: `${BASE}/bubblefish-texture.webp`,
    thumbUrl: `${BASE}/bubblefish-thumb.webp`,
    accent: '#7FCBD8',
    motion: 'rope',
    size: 1.0,
  },
  {
    id: 'clownfish',
    label: 'Clownfish',
    emoji: '🐠',
    shapeUrl: `${BASE}/clownfish-shape.webp`,
    detailsUrl: `${BASE}/clownfish-details.webp`,
    textureUrl: `${BASE}/clownfish-texture.webp`,
    thumbUrl: `${BASE}/clownfish-thumb.webp`,
    accent: '#EE7D54',
    motion: 'rope',
    size: 1.02,
  },
  {
    id: 'tang',
    label: 'Blue Tang',
    emoji: '🐟',
    shapeUrl: `${BASE}/tang-shape.webp`,
    detailsUrl: `${BASE}/tang-details.webp`,
    textureUrl: `${BASE}/tang-texture.webp`,
    thumbUrl: `${BASE}/tang-thumb.webp`,
    accent: '#72A7E8',
    motion: 'rope',
    size: 1.06,
  },
  {
    id: 'shark',
    label: 'Baby Shark',
    emoji: '🦈',
    shapeUrl: `${BASE}/shark-shape.webp`,
    detailsUrl: `${BASE}/shark-details.webp`,
    textureUrl: `${BASE}/shark-texture.webp`,
    thumbUrl: `${BASE}/shark-thumb.webp`,
    accent: '#89AFCB',
    motion: 'rope',
    size: 1.14,
  },
  {
    id: 'babyfish',
    label: 'Baby Fish',
    emoji: '🐟',
    shapeUrl: `${BASE}/babyfish-shape.webp`,
    detailsUrl: `${BASE}/babyfish-details.webp`,
    textureUrl: `${BASE}/babyfish-texture.webp`,
    thumbUrl: `${BASE}/babyfish-thumb.webp`,
    accent: '#F3B59E',
    motion: 'rope',
    size: 0.82,
  },
  {
    id: 'spotfish',
    label: 'Spotfish',
    emoji: '🐟',
    shapeUrl: `${BASE}/spotfish-shape.webp`,
    detailsUrl: `${BASE}/spotfish-details.webp`,
    textureUrl: `${BASE}/spotfish-texture.webp`,
    thumbUrl: `${BASE}/spotfish-thumb.webp`,
    accent: '#A5C97A',
    motion: 'rope',
    size: 0.98,
  },
  {
    id: 'grouper',
    label: 'Grouper',
    emoji: '🐟',
    shapeUrl: `${BASE}/grouper-shape.webp`,
    detailsUrl: `${BASE}/grouper-details.webp`,
    textureUrl: `${BASE}/grouper-texture.webp`,
    thumbUrl: `${BASE}/grouper-thumb.webp`,
    accent: '#8DC7A3',
    motion: 'rope',
    size: 1.04,
  },
  {
    id: 'angelfish',
    label: 'Angelfish',
    emoji: '🐠',
    shapeUrl: `${BASE}/angelfish-shape.webp`,
    detailsUrl: `${BASE}/angelfish-details.webp`,
    textureUrl: `${BASE}/angelfish-texture.webp`,
    thumbUrl: `${BASE}/angelfish-thumb.webp`,
    accent: '#A9B9F0',
    motion: 'rope',
    size: 1.02,
  },
  {
    id: 'free',
    label: 'Gambar Bebas',
    emoji: '✏️',
    shapeUrl: '',
    detailsUrl: '',
    textureUrl: '',
    thumbUrl: '',
    accent: '#F4A259',
    motion: 'drift',
    size: 1,
    free: true,
  },
];

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((template) => [template.id, template])) as Record<
  FishTemplateId,
  FishTemplate
>;

export function getTemplate(id: FishTemplateId): FishTemplate {
  return TEMPLATE_MAP[id] ?? TEMPLATES[0];
}

export interface StudioColor {
  name: string;
  color: string;
}

/** 24 balanced colors: warm, ocean, earth, and candy accents. */
export const STUDIO_SWATCHES: StudioColor[] = [
  { name: 'Oranye', color: '#F4A259' },
  { name: 'Matahari', color: '#F7C95C' },
  { name: 'Terracotta', color: '#D96C5F' },
  { name: 'Koral', color: '#EF8354' },
  { name: 'Pasir', color: '#F2D0A4' },
  { name: 'Krem', color: '#FFF3E0' },
  { name: 'Mint', color: '#8ED1C6' },
  { name: 'Toska', color: '#4FB8B0' },
  { name: 'Teal Tua', color: '#2F8F9D' },
  { name: 'Langit', color: '#6EC6E6' },
  { name: 'Samudra', color: '#3C7BD9' },
  { name: 'Navy', color: '#2E5C8A' },
  { name: 'Lime', color: '#B8D96B' },
  { name: 'Daun', color: '#6FAE5E' },
  { name: 'Rose', color: '#F29BB0' },
  { name: 'Orchid', color: '#C77DBB' },
  { name: 'Violet', color: '#9B7EDE' },
  { name: 'Indigo', color: '#6C5CE7' },
  { name: 'Kakao', color: '#8B5E4C' },
  { name: 'Arang', color: '#5B4438' },
  { name: 'Peach', color: '#E8A87C' },
  { name: 'Putih', color: '#FFF9EE' },
  { name: 'Tinta', color: '#2B2D42' },
  { name: 'Aqua', color: '#A7E8E0' },
];
