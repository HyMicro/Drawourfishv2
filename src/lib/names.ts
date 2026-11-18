const FIRST = [
  'Bubbles', 'Mochi', 'Bloop', 'Kiki', 'Pip', 'Nori', 'Pearl', 'Splash',
  'Ziggy', 'Coral', 'Sunny', 'Mimi', 'Boba', 'Pebble', 'Luna', 'Tofu',
  'Sprout', 'Waffle', 'Doodle', 'Jelly', 'Mango', 'Pudding', 'Puff', 'Squeak',
  'Tiny', 'Wiggle', 'Zumi', 'Nemo', 'Coco', 'Flippy', 'Guppy', 'Kelp',
];

const SECOND = ['', 'pop', 'bean', 'fin', 'boo', 'tail', 'cake', 'bop', 'reef', 'shine'];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function randomFishName(): string {
  const first = pick(FIRST);
  const second = pick(SECOND);
  if (!second) return first;
  return `${first}${second}`;
}

export function normalizeFishName(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N} '\-_]/gu, '').replace(/\s+/g, ' ').trim();
  return clean.slice(0, 20) || randomFishName();
}
