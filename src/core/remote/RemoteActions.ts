/**
 * Operaciones abstractas que un control remoto puede pedirle a la app. La UI
 * (App) provee la implementación concreta (mover selección, reproducir, etc.);
 * los comandos y el router dependen solo de esta interfaz.
 */
export interface RemoteActions {
  /** Mueve el cursor `delta` pistas (−1 arriba, +1 abajo). */
  moveCursor(delta: number): void;
  /** Mueve el cursor `delta` carpetas (−1 anterior, +1 siguiente). */
  moveFolder(delta: number): void;
  /** Reproduce la 1ª pista de la carpeta a `delta` de la que suena. */
  playFolderOffset(delta: number): void;
  /** Alterna play/pausa. */
  togglePlayPause(): void;
  /** Reanuda la reproducción. */
  play(): void;
  /** Pausa la reproducción. */
  pause(): void;
  /** Salta a la pista siguiente. */
  nextTrack(): void;
  /** Salta a la pista anterior. */
  previousTrack(): void;
  /** Adelanta (positivo) o atrasa (negativo) `seconds` segundos. */
  seekBy(seconds: number): void;
}
