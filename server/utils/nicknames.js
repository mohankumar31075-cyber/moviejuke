// Child-safety helpers: nickname filtering + auto-generated fun nicknames.

const BANNED = [
  'idiot', 'stupid', 'dumb', 'hate', 'kill', 'die', 'sex', 'sexy', 'porn', 'nude',
  'abuse', 'abusive', 'bastard', 'bitch', 'damn', 'crap', 'poop', 'loo', 'toilet',
  'drug', 'beer', 'wine', 'cigarette', 'gamble', 'bet', 'suicide', 'terror',
  'bomb', 'gun', 'knife', 'blood', 'fight', 'punch', 'kick', 'slap',
  // mild Hindi/abuse transliterations kept generic
  'bakwas', 'bewakoof', 'pagal', 'kamina', 'ganda',
];

const ADJECTIVES = ['Speedy', 'Brave', 'Happy', 'Clever', 'Sunny', 'Super', 'Calm', 'Bright', 'Jolly', 'Mighty', 'Swift', 'Cheery'];
const ANIMALS = ['Tiger', 'Parrot', 'Panda', 'Dolphin', 'Falcon', 'Otter', 'Koala', 'Peacock', 'Rabbit', 'Lion', 'Penguin', 'Squirrel'];

export function isClean(nickname) {
  const n = String(nickname || '').toLowerCase();
  return n.length >= 2 && n.length <= 20 && !BANNED.some((w) => n.includes(w));
}

export function filterNickname(nickname) {
  const raw = String(nickname || '').trim().slice(0, 20);
  if (isClean(raw)) return raw;
  // Strip bad bits; if unusable, generate one.
  let cleaned = raw.replace(/[^a-zA-Z0-9]/g, '');
  if (!isClean(cleaned) || cleaned.length < 2) return randomNickname();
  return cleaned;
}

export function randomNickname() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${a}${b}${Math.floor(10 + Math.random() * 90)}`;
}
