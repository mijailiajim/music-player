import {State} from 'react-native-track-player';

/**
 * true mientras suena o está por sonar (cargando la canción): es lo que la
 * pantalla muestra como "sonando" y lo que mantiene despierto el equipo.
 */
export function isPlayingState(state: State | undefined): boolean {
  return (
    state === State.Playing ||
    state === State.Buffering ||
    state === State.Loading
  );
}
