/** Datos de presentación del jugador: nombres, avatares y reacciones permitidas. */

export const AVATARS = ['⚓', '🚢', '🦈', '🐋', '🐙', '🦀', '🏴‍☠️', '🧭', '🦊', '🐼', '🦁', '🐧'];
export const REACTIONS = ['👍', '😂', '😮', '🔥', '👏', '😭'];

export function cleanName(raw, fallback = 'Invitado') {
  const text = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16)
    .trim();
  return text || fallback;
}

export function cleanAvatar(raw) {
  return AVATARS.includes(raw) ? raw : '';
}
