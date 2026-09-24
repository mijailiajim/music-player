import {PlayableTrack} from './PlayableTrack';

export interface PlaybackProgress {
  position: number;
  duration: number;
}

/**
 * Puerto (DIP) que abstrae el motor de reproducción. El `PlaybackController`
 * depende de esta interfaz, no de react-native-track-player; el adaptador
 * concreto vive en `src/adapters`.
 */
export interface AudioPlayerPort {
  setup(): Promise<void>;
  reset(): Promise<void>;
  add(tracks: PlayableTrack[]): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  skipTo(index: number): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  getProgress(): Promise<PlaybackProgress>;
  /** true si está sonando o cargando (para alternar play/pausa). */
  isActive(): Promise<boolean>;
}
