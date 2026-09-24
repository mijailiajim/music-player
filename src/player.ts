/**
 * Fachada de reproducción para la UI. La lógica vive en `PlaybackController`
 * (núcleo) sobre un `AudioPlayerPort` implementado por el adaptador de
 * react-native-track-player. Acá solo se expone como funciones/constantes que
 * ya usaba la app (y los tests).
 */
import {State, Track} from 'react-native-track-player';
import {playbackController} from './composition';
import {FolderGroup} from './core/model';
import {SEEK_STEP_SECONDS} from './core/playback/constants';

/** Track de la cola con los metadatos de carpeta que agrega esta app. */
export interface QueueTrack extends Track {
  folderIndex: number;
  indexInFolder: number;
}

export {SEEK_STEP_SECONDS};

export function setupPlayerOnce(): Promise<void> {
  return playbackController.setupOnce();
}

export function loadQueue(
  groups: FolderGroup[],
  autoplay: boolean,
): Promise<void> {
  return playbackController.loadQueue(groups, autoplay);
}

export function clearQueue(): Promise<void> {
  return playbackController.clearQueue();
}

export function playTrackAt(globalIndex: number): Promise<void> {
  return playbackController.playTrackAt(globalIndex);
}

export function play(): Promise<void> {
  return playbackController.resume();
}

export function pause(): Promise<void> {
  return playbackController.pause();
}

export function togglePlayPause(): Promise<void> {
  return playbackController.togglePlayPause();
}

export function skipToNext(): Promise<void> {
  return playbackController.skipToNext();
}

export function skipToPrevious(): Promise<void> {
  return playbackController.skipToPrevious();
}

export function seekBy(offsetSeconds: number): Promise<void> {
  return playbackController.seekBy(offsetSeconds);
}

export function isPlayingState(state: State | undefined): boolean {
  return (
    state === State.Playing ||
    state === State.Buffering ||
    state === State.Loading
  );
}

export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
