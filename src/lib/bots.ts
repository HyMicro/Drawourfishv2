import type { FishEntity, FishTemplateId } from '../../shared/protocol';
import { getTemplate } from '../data/templates';
import { renderFishTexture } from './fishArt';
import { createId, randomBetween } from './utils';

const BOT_NAMES = ['Kiki', 'Bubbles', 'Mochi', 'Pip'];
const BOT_TEMPLATES: FishTemplateId[] = ['goldfish', 'puffer', 'clownfish', 'angelfish'];

/** Friendly AI reef residents used for the offline / local fallback. */
export function createBotFishes(): FishEntity[] {
  return BOT_NAMES.map((name, index) => {
    const templateId = BOT_TEMPLATES[index % BOT_TEMPLATES.length];
    const template = getTemplate(templateId);
    return {
      id: `bot-${index}-${createId().slice(0, 8)}`,
      ownerId: 'bot-reef',
      name,
      templateId,
      textureData: renderFishTexture(template),
      createdAt: Date.now(),
      transform: {
        x: randomBetween(0.16, 0.84),
        y: randomBetween(0.26, 0.72),
        targetX: randomBetween(0.2, 0.8),
        targetY: randomBetween(0.3, 0.7),
        speed: randomBetween(0.32, 0.52),
        facing: Math.random() > 0.5 ? 1 : -1,
      },
      state: 'WANDER',
    };
  });
}
