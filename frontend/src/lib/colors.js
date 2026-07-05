// Deterministic display helpers for avatars and group-chat sender names.

const AVATAR_COLORS = [
  '#e57373', '#f06292', '#ba68c8', '#9575cd', '#7986cb',
  '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784',
  '#aed581', '#ffb74d', '#ff8a65', '#a1887f', '#90a4ae',
];

const SENDER_COLORS = [
  '#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899',
  '#14b8a6', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4',
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getInitial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

export function getAvatarColor(name) {
  return AVATAR_COLORS[hashString(name || '') % AVATAR_COLORS.length];
}

export function getSenderColor(sender) {
  return SENDER_COLORS[hashString(sender || '') % SENDER_COLORS.length];
}
