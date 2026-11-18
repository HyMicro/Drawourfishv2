import type { FishEntity, FishTemplateId } from '../../shared/protocol';
import { getTemplate } from '../data/templates';
import { createId, randomBetween } from './utils';

const BOT_NAMES = ['Kiki', 'Bubbles', 'Mochi', 'Pip'];
const BOT_TEMPLATES: FishTemplateId[] = ['goldfish', 'puffer', 'bubblefish', 'tang'];

/** Friendly AI reef residents used for the offline / local fallback. */
const BOT_SPAWNS = [
  { x: 0.28, y: 0.46, facing: 1 as const },
  { x: 0.72, y: 0.58, facing: -1 as const },
  { x: 0.4, y: 0.3, facing: 1 as const },
  { x: 0.62, y: 0.7, facing: -1 as const },
];

export function createBotFishes(): FishEntity[] {
  return BOT_NAMES.map((name, index) => {
    const templateId = BOT_TEMPLATES[index % BOT_TEMPLATES.length];
    const template = getTemplate(templateId);
    const spawn = BOT_SPAWNS[index % BOT_SPAWNS.length];
    return {
      id: `bot-${index}-${createId().slice(0, 8)}`,
      ownerId: 'bot-reef',
      name,
      templateId,
      textureData: template.textureUrl,
      createdAt: Date.now(),
      transform: {
        x: spawn.x,
        y: spawn.y,
        targetX: randomBetween(0.22, 0.78),
        targetY: randomBetween(0.3, 0.7),
        speed: randomBetween(0.32, 0.52),
        facing: spawn.facing,
      },
      state: 'WANDER',
    };
  });
}
