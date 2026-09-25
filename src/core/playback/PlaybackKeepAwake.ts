import TrackPlayer, {Event, State} from 'react-native-track-player';
import {isPlayingState} from './playbackStates';

/** Lo que necesita del keep awake nativo (lo implementa `src/native/KeepAwake.ts`). */
export interface KeepAwakePort {
  /** true: el equipo no se duerme aunque se apague la pantalla. */
  setPlaybackAwake(awake: boolean): void;
}

/**
 * Keep awake de la reproducción: mientras suena música (o carga la siguiente
 * canción) el equipo no se duerme aunque la pantalla esté apagada —p. ej.
 * fuera de la app—, así la música no se corta. En pausa, detenida o con error
 * lo suelta, para no gastar batería de más.
 *
 * Que la pantalla nunca se apague mientras la app está en uso lo hace el lado
 * nativo (KeepAwake y ScreenOnGuard).
 */
export class PlaybackKeepAwake {
  private awake = false;

  constructor(private readonly keepAwake: KeepAwakePort) {}

  /** Sigue el estado del reproductor (lo llama el servicio de reproducción). */
  register(): void {
    TrackPlayer.addEventListener(Event.PlaybackState, event =>
      this.update(event.state),
    );
  }

  /** Pide o suelta el keep awake según el estado; solo avisa si cambia. */
  update(state: State | undefined): void {
    const awake = isPlayingState(state);
    if (awake !== this.awake) {
      this.awake = awake;
      this.keepAwake.setPlaybackAwake(awake);
    }
  }
}
