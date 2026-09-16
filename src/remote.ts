import {KeyCodes} from './keymap';

/**
 * Interpretación de las teclas del control remoto, con soporte de pulsación
 * corta vs. mantenida para controles con pocos botones (air mouse 2.4 GHz o
 * Bluetooth con solo flechas + OK + Menú):
 *
 *   ▲/▼            mover la selección (mantener = desplazamiento rápido)
 *   ◀/▶  corta     carpeta anterior / siguiente
 *   ◀/▶  mantenida atrasar / adelantar (continuo mientras se sostiene)
 *   OK   corta     reproducir la selección
 *   OK   mantenida play / pausa
 *   MENÚ corta     pista siguiente
 *   MENÚ mantenida pista anterior
 *
 * Las teclas multimedia dedicadas actúan directo en la pulsación inicial.
 */

export interface RemoteKeyEventPayload {
  keyCode: number;
  repeatCount?: number;
  action?: 'down' | 'up';
}

export interface RemoteActions {
  moveSelection: (delta: number) => void;
  moveFolder: (delta: number) => void;
  playSelection: () => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seekBy: (seconds: number) => void;
  playFolderOffset: (delta: number) => void;
  play: () => void;
  pause: () => void;
}

/** Sostener más que esto cuenta como pulsación larga. */
export const HOLD_MS = 550;
/** Cadencia del seek continuo mientras se mantiene ◀/▶. */
export const SEEK_HOLD_THROTTLE_MS = 450;
/**
 * Sin autorepetición ni key-up (hardware raro), a este tiempo se asume
 * pulsación larga; el key-up tardío posterior se ignora.
 */
export const HOLD_FALLBACK_MS = 1500;

const OK_KEYS: ReadonlySet<number> = new Set([
  KeyCodes.DPAD_CENTER,
  KeyCodes.ENTER,
  KeyCodes.NUMPAD_ENTER,
  KeyCodes.BUTTON_SELECT,
  KeyCodes.BUTTON_A,
]);

type HoldKind = 'ok' | 'left' | 'right' | 'menu';

function holdKindOf(keyCode: number): HoldKind | null {
  if (OK_KEYS.has(keyCode)) {
    return 'ok';
  }
  if (keyCode === KeyCodes.DPAD_LEFT) {
    return 'left';
  }
  if (keyCode === KeyCodes.DPAD_RIGHT) {
    return 'right';
  }
  if (keyCode === KeyCodes.MENU) {
    return 'menu';
  }
  return null;
}

interface PressState {
  kind: HoldKind;
  downAt: number;
  longFired: boolean;
  lastSeekAt: number;
  fallback: ReturnType<typeof setTimeout> | null;
}

export function createRemoteKeyHandler(
  actions: RemoteActions,
  seekStep: number,
): (event: RemoteKeyEventPayload) => void {
  const pressed = new Map<number, PressState>();

  const shortAction = (kind: HoldKind) => {
    switch (kind) {
      case 'ok':
        actions.playSelection();
        break;
      case 'left':
        actions.moveFolder(-1);
        break;
      case 'right':
        actions.moveFolder(1);
        break;
      case 'menu':
        actions.nextTrack();
        break;
    }
  };

  const longAction = (kind: HoldKind) => {
    switch (kind) {
      case 'ok':
        actions.togglePlayPause();
        break;
      case 'left':
        actions.seekBy(-seekStep);
        break;
      case 'right':
        actions.seekBy(seekStep);
        break;
      case 'menu':
        actions.previousTrack();
        break;
    }
  };

  const clearFallback = (state: PressState) => {
    if (state.fallback != null) {
      clearTimeout(state.fallback);
      state.fallback = null;
    }
  };

  const handleSimpleKey = (keyCode: number, repeatCount: number) => {
    switch (keyCode) {
      case KeyCodes.DPAD_UP:
        actions.moveSelection(-1);
        return;
      case KeyCodes.DPAD_DOWN:
        actions.moveSelection(1);
        return;
    }
    if (repeatCount > 0) {
      return;
    }
    switch (keyCode) {
      case KeyCodes.MEDIA_PLAY_PAUSE:
      case KeyCodes.HEADSETHOOK:
        actions.togglePlayPause();
        return;
      case KeyCodes.MEDIA_PLAY:
        actions.play();
        return;
      case KeyCodes.MEDIA_PAUSE:
      case KeyCodes.MEDIA_STOP:
        actions.pause();
        return;
      case KeyCodes.MEDIA_NEXT:
        actions.nextTrack();
        return;
      case KeyCodes.MEDIA_PREVIOUS:
        actions.previousTrack();
        return;
      case KeyCodes.MEDIA_FAST_FORWARD:
        actions.seekBy(seekStep);
        return;
      case KeyCodes.MEDIA_REWIND:
        actions.seekBy(-seekStep);
        return;
      case KeyCodes.CHANNEL_UP:
      case KeyCodes.PAGE_DOWN:
        actions.playFolderOffset(1);
        return;
      case KeyCodes.CHANNEL_DOWN:
      case KeyCodes.PAGE_UP:
        actions.playFolderOffset(-1);
        return;
    }
  };

  return event => {
    const keyCode = event.keyCode;
    const action = event.action ?? 'down';
    const repeatCount = event.repeatCount ?? 0;
    const kind = holdKindOf(keyCode);

    if (kind == null) {
      if (action === 'down') {
        handleSimpleKey(keyCode, repeatCount);
      }
      return;
    }

    if (action === 'down') {
      if (repeatCount === 0) {
        const state: PressState = {
          kind,
          downAt: Date.now(),
          longFired: false,
          lastSeekAt: 0,
          fallback: null,
        };
        state.fallback = setTimeout(() => {
          state.fallback = null;
          if (pressed.get(keyCode) === state && !state.longFired) {
            state.longFired = true;
            state.lastSeekAt = Date.now();
            longAction(kind);
          }
        }, HOLD_FALLBACK_MS);
        pressed.set(keyCode, state);
        return;
      }
      const state = pressed.get(keyCode);
      if (state == null || Date.now() - state.downAt < HOLD_MS) {
        return;
      }
      if (kind === 'left' || kind === 'right') {
        if (Date.now() - state.lastSeekAt >= SEEK_HOLD_THROTTLE_MS) {
          state.lastSeekAt = Date.now();
          state.longFired = true;
          clearFallback(state);
          longAction(kind);
        }
      } else if (!state.longFired) {
        state.longFired = true;
        clearFallback(state);
        longAction(kind);
      }
      return;
    }

    // key-up
    const state = pressed.get(keyCode);
    if (state == null) {
      return; // ya resuelto (fallback) o pulsación huérfana
    }
    pressed.delete(keyCode);
    clearFallback(state);
    if (state.longFired) {
      return;
    }
    if (Date.now() - state.downAt >= HOLD_MS) {
      // Mantenida en un control sin autorepetición: una sola acción larga.
      longAction(state.kind);
    } else {
      shortAction(state.kind);
    }
  };
}
