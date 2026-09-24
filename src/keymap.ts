/** Códigos de tecla de Android (android.view.KeyEvent) que reenvía MainActivity. */
export const KeyCodes = {
  BACK: 4,
  DPAD_UP: 19,
  DPAD_DOWN: 20,
  DPAD_LEFT: 21,
  DPAD_RIGHT: 22,
  DPAD_CENTER: 23,
  SPACE: 62,
  ENTER: 66,
  HEADSETHOOK: 79,
  MEDIA_PLAY_PAUSE: 85,
  MEDIA_STOP: 86,
  MEDIA_NEXT: 87,
  MEDIA_PREVIOUS: 88,
  MEDIA_REWIND: 89,
  MEDIA_FAST_FORWARD: 90,
  PAGE_UP: 92,
  PAGE_DOWN: 93,
  BUTTON_A: 96,
  BUTTON_SELECT: 109,
  MEDIA_PLAY: 126,
  MEDIA_PAUSE: 127,
  NUMPAD_ENTER: 160,
  CHANNEL_UP: 166,
  CHANNEL_DOWN: 167,
} as const;

export interface RemoteKeyEvent {
  keyCode: number;
  repeatCount: number;
  /** Apretar o soltar (las teclas que la app necesita soltar mandan las dos). */
  action?: 'down' | 'up';
}
