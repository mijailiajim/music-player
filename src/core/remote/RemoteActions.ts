/**
 * Operaciones abstractas que un control remoto puede pedirle a la app. La UI
 * (App) provee la implementación concreta (mover selección, reproducir, etc.);
 * los comandos y el router dependen solo de esta interfaz.
 */
export interface RemoteActions {
  /** Mueve el cursor `delta` ítems de la lista (−1 arriba, +1 abajo). */
  moveCursor(delta: number): void;
  /**
   * Resalta y reproduce la canción anterior (−1) o siguiente (+1) de la lista;
   * en los extremos no hace nada.
   */
  playAdjacent(delta: number): void;
  /** Reproduce la canción resaltada (sobre una carpeta no hace nada). */
  playSelection(): void;
  /** Sube un nivel de carpeta. */
  goUp(): void;
  /** Entra a la carpeta resaltada. */
  enterFolder(): void;
  /** Reproduce la 1ª pista de la carpeta con música a `delta` de la que suena. */
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
