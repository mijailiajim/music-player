/**
 * Modelos del dominio (sin dependencias de React Native ni de librerías). Son
 * las estructuras de datos que comparten las clases del núcleo (`src/core`).
 */

/** Entrada de un directorio del pendrive. */
export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

/** Una pista de música dentro de una carpeta. */
export interface TrackInfo {
  title: string;
  path: string;
  url: string;
  folderName: string;
  folderIndex: number;
  indexInFolder: number;
}

/** Una carpeta con música y su posición dentro de la cola global. */
export interface FolderGroup {
  name: string;
  path: string;
  /** Posición del primer tema de la carpeta dentro de la cola global. */
  startIndex: number;
  tracks: TrackInfo[];
}

/**
 * Carpeta del pendrive tal como se navega: TODAS sus subcarpetas (tengan o no
 * música, sin las ocultas ni las de sistema) y sus canciones reproducibles.
 */
export interface FolderNode {
  /** Nombre de la carpeta (el de la raíz es `ROOT_FOLDER_NAME`). */
  name: string;
  /** Ruta desde la raíz para mostrar, p. ej. "A / A-sub". */
  label: string;
  path: string;
  /** Subcarpetas en orden alfabético. */
  folders: FolderNode[];
  /** Canciones reproducibles de esta carpeta, en orden alfabético. */
  tracks: TrackInfo[];
  /** Canciones reproducibles en esta carpeta y en todas sus subcarpetas. */
  trackCount: number;
}

/** Volumen de almacenamiento reportado por el sistema. */
export interface StorageVolumeInfo {
  path: string;
  description: string;
  removable: boolean;
  primary: boolean;
  state: string;
}
