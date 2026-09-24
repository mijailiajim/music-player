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

/** Volumen de almacenamiento reportado por el sistema. */
export interface StorageVolumeInfo {
  path: string;
  description: string;
  removable: boolean;
  primary: boolean;
  state: string;
}

/** Ítem resaltado: carpeta y pista dentro de ella. */
export interface Selection {
  folder: number;
  track: number;
}
