import {Event} from 'react-native-track-player';
import {Signal} from '../core/signals/Signal';
import {SignalFactory} from '../core/signals/SignalFactory';

/** Forma mínima de un evento de react-native-track-player. */
export interface PlayerEventLike {
  type: string;
  state?: unknown;
  position?: unknown;
  interval?: unknown;
}

/**
 * Traduce eventos de react-native-track-player a señales para mostrar: el
 * estado del reproductor (así se ve el botón OK: buffering → ready → playing)
 * y todos los comandos de la sesión de medios (Remote*). El progreso no: llega
 * cada segundo. La lista se arma dinámicamente por si la versión de la
 * librería no trae alguno.
 */
export class TrackPlayerSignalTranslator {
  /** Eventos a los que hay que suscribirse para mostrarlos. */
  readonly events: Event[];
  private readonly mediaCommands: Set<string>;

  constructor(private readonly factory: SignalFactory) {
    const remote = Object.keys(Event)
      .filter(name => name.startsWith('Remote'))
      .map(name => (Event as Record<string, Event>)[name]);
    this.mediaCommands = new Set<string>(remote);
    this.events = [Event.PlaybackState, ...remote].filter(
      (type): type is Event => typeof type === 'string',
    );
  }

  /** La señal que representa el evento, o null si no es de los que se muestran. */
  translate(event: PlayerEventLike): Signal | null {
    if (event.type === Event.PlaybackState && typeof event.state === 'string') {
      return this.factory.playbackState(event.state);
    }
    if (this.mediaCommands.has(event.type)) {
      return this.factory.mediaCommand(event.type, this.detailOf(event));
    }
    return null;
  }

  private detailOf(event: PlayerEventLike): string | undefined {
    if (typeof event.position === 'number') {
      return `${Math.round(event.position)}s`;
    }
    if (typeof event.interval === 'number') {
      return `${event.interval}s`;
    }
    return undefined;
  }
}
