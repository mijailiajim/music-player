import {KeyNameResolver} from './KeyNameResolver';
import {Signal} from './Signal';

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

  /** Volumen multimedia del sistema: "volumen 8/15". */
  volume(level: number, max: number): Signal {
    return {
      label: max > 0 ? `volumen ${level}/${max}` : `volumen ${level}`,
      origin: 'media',
      slot: 'volume',
    };
  }
}
