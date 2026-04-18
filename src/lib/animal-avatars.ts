// Animal avatar illustrations for users without profile photos
// Uses DiceBear API with "thumbs" style for fun animal-like avatars
// The seed is based on user ID so the same user always gets the same avatar

const ANIMAL_EMOJIS = [
  '🐶', '🐱', '🐻', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵',
  '🐔', '🐧', '🐦', '🐺', '🦄', '🐴', '🦋', '🐙', '🐬', '🐳',
  '🦅', '🦉', '🐘', '🦒', '🐿️', '🦜', '🐢', '🐠', '🦈', '🐊',
];

/**
 * Get a DiceBear avatar URL for a user without a profile photo.
 * Uses "thumbs" style which generates cute, colorful avatar illustrations.
 * The avatar is deterministic based on the seed (user ID or name).
 */
export function getAnimalAvatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed);
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encoded}&backgroundColor=0a5b83,1c799f,69d2e7,f1f4dc,f88c49,d1d4f9,c0aede,b6e3f4,ffd5dc,ffdfbf&radius=50`;
}

/**
 * Get a random animal emoji based on user ID (deterministic).
 */
export function getAnimalEmoji(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return ANIMAL_EMOJIS[Math.abs(hash) % ANIMAL_EMOJIS.length];
}
