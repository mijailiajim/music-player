/** ▲ / ▼ mantenidas: recorren la lista a 3 canciones por segundo. */
export const CURSOR_REPEAT_MS = 1000 / 3;

/**
 * ◀ / ▶: soltar antes de este tiempo es un toque (canción vecina); mantener
 * más es adelantar/atrasar.
 */
export const HOLD_THRESHOLD_MS = 500;
