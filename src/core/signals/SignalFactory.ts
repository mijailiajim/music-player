import {KeyNameResolver} from './KeyNameResolver';
import {Signal} from './Signal';

/** Cambios de la app que delatan que un botón abrió otra cosa (p. ej. el asistente). */
export type AppFocusChange = 'blur' | 'focus' | 'background';

const APP_LABELS: Record<AppFocusChange, string> = {
  blur: 'app sin foco',
  focus: 'app con foco',
  background: 'app en segundo plano',
};

/** Arma las señales a mostrar a partir de lo que recibe la app. */
export class SignalFactory {
  constructor(private readonly keyNames: KeyNameResolver) {}

  /** Tecla física del control: "DPAD_DOWN(20)". */
  key(keyCode: number, repeatCount = 0, nativeName?: string): Signal {
    return {
      label: this.keyNames.label(keyCode, nativeName),
      origin: 'key',
      repeat: repeatCount > 0,
    };
  }

  /** Estado del reproductor: "buffering", "ready", "playing", "paused"… */
  playbackState(state: string): Signal {
    return {label: state, origin: 'media'};
  }

  /** Comando de la sesión de medios: "remote-previous", "remote-seek 42s"… */
  mediaCommand(type: string, detail?: string): Signal {
    return {label: detail ? `${type} ${detail}` : type, origin: 'media'};
  }

  /** Clic del puntero del air mouse (el OK cuando el control está en modo cursor). */
  pointerClick(): Signal {
    return {label: 'CLIC(mouse)', origin: 'key'};
  }

  /** La app pierde / recupera el foco o pasa a segundo plano. */
  app(change: AppFocusChange): Signal {
    return {label: APP_LABELS[change], origin: 'media'};
  }
}
