/**
 * Fachada de escaneo del pendrive y armado de la cola. La lógica vive en clases
 * de responsabilidad única bajo `src/core/scanning`; acá se componen y se
 * exponen como funciones para el resto de la app (y para los tests).
 *
 * Regla de orden:
 *  1. Si hay archivos de audio en la raíz del pendrive, van primero, en orden
 *     alfabético de nombre de archivo.
 *  2. Después las carpetas en orden alfabético; dentro de cada carpeta, los
 *     archivos alfabéticos. Las subcarpetas se recorren en profundidad,
 *     inmediatamente después de su carpeta madre.
 */
import {DirEntry, FolderGroup, TrackInfo} from './core/model';
import {MusicLibrary} from './core/library/MusicLibrary';
import {AudioFilePolicy} from './core/scanning/AudioFilePolicy';
import {FileUrlFactory} from './core/scanning/FileUrlFactory';
import {NameComparator} from './core/scanning/NameComparator';
import {SystemFolderFilter} from './core/scanning/SystemFolderFilter';
import {
  ROOT_FOLDER_NAME,
  ScanOptions,
  VolumeScanner,
} from './core/scanning/VolumeScanner';

export type {DirEntry, TrackInfo, FolderGroup, ScanOptions};
export type ListDir = (path: string) => Promise<DirEntry[]>;
export {ROOT_FOLDER_NAME};

const audioPolicy = new AudioFilePolicy();
const nameComparator = new NameComparator();
const urlFactory = new FileUrlFactory();
const systemFolderFilter = new SystemFolderFilter();
const scanner = new VolumeScanner(
  audioPolicy,
  nameComparator,
  urlFactory,
  systemFolderFilter,
);

export function isAudioFile(name: string): boolean {
  return audioPolicy.isAudio(name);
}

export function titleFromFileName(name: string): string {
  return audioPolicy.title(name);
}

export function compareNames(a: string, b: string): number {
  return nameComparator.compare(a, b);
}

export function fileUrl(path: string): string {
  return urlFactory.from(path);
}

export function scanVolume(
  rootPath: string,
  listDir: ListDir,
  options: ScanOptions = {},
): Promise<FolderGroup[]> {
  return scanner.scan(rootPath, {list: listDir}, options);
}

export function flattenGroups(groups: FolderGroup[]): TrackInfo[] {
  return new MusicLibrary(groups).flatten();
}

export function totalTracks(groups: FolderGroup[]): number {
  return new MusicLibrary(groups).totalTracks;
}
