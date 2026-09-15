/**
 * Lógica pura de escaneo del pendrive y armado de la cola de reproducción.
 * Sin dependencias de React Native para poder testearla con Jest.
 *
 * Regla de orden:
 *  1. Si hay archivos de audio en la raíz del pendrive, esos van primero,
 *     en orden alfabético de nombre de archivo.
 *  2. Después (o si la raíz no tiene música), las carpetas en orden
 *     alfabético; dentro de cada carpeta los archivos en orden alfabético.
 *     Las subcarpetas se recorren en profundidad, también alfabéticamente,
 *     inmediatamente después de su carpeta madre.
 */

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface TrackInfo {
  title: string;
  path: string;
  url: string;
  folderName: string;
  folderIndex: number;
  indexInFolder: number;
}

export interface FolderGroup {
  name: string;
  path: string;
  /** Posición del primer tema de la carpeta dentro de la cola global. */
  startIndex: number;
  tracks: TrackInfo[];
}

export type ListDir = (path: string) => Promise<DirEntry[]>;

export interface ScanOptions {
  maxDepth?: number;
  maxTracks?: number;
}

export const ROOT_FOLDER_NAME = 'Raíz del pendrive';

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'm4b',
  'aac',
  'wav',
  'ogg',
  'oga',
  'opus',
  'flac',
  'amr',
  'mka',
]);

const SKIPPED_FOLDERS = new Set([
  'android',
  'lost.dir',
  'system volume information',
  '$recycle.bin',
  'recycler',
  '.trashes',
  '.spotlight-v100',
]);

export function isAudioFile(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) {
    return false;
  }
  return AUDIO_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

/** Orden alfabético insensible a mayúsculas y con números en orden natural. */
export function compareNames(a: string, b: string): number {
  return (
    a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}) ||
    a.localeCompare(b)
  );
}

export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).trim();
}

/** file:// con cada segmento percent-encodeado (espacios, #, ? ...). */
export function fileUrl(path: string): string {
  return 'file://' + path.split('/').map(encodeURIComponent).join('/');
}

export async function scanVolume(
  rootPath: string,
  listDir: ListDir,
  options: ScanOptions = {},
): Promise<FolderGroup[]> {
  const maxDepth = options.maxDepth ?? 8;
  const maxTracks = options.maxTracks ?? 5000;
  const groups: FolderGroup[] = [];
  let total = 0;
  let startIndex = 0;

  const walk = async (
    dirPath: string,
    nameParts: string[],
    depth: number,
  ): Promise<void> => {
    if (depth > maxDepth || total >= maxTracks) {
      return;
    }
    let entries: DirEntry[];
    try {
      entries = await listDir(dirPath);
    } catch {
      return;
    }
    const visible = entries.filter(
      e => e.name.length > 0 && !e.name.startsWith('.'),
    );
    const files = visible
      .filter(e => !e.isDirectory && isAudioFile(e.name))
      .sort((a, b) => compareNames(a.name, b.name));
    const dirs = visible
      .filter(e => e.isDirectory && !SKIPPED_FOLDERS.has(e.name.toLowerCase()))
      .sort((a, b) => compareNames(a.name, b.name));

    if (files.length > 0) {
      const folderIndex = groups.length;
      const folderName =
        nameParts.length === 0 ? ROOT_FOLDER_NAME : nameParts.join(' / ');
      const tracks = files
        .slice(0, Math.max(0, maxTracks - total))
        .map((file, indexInFolder) => ({
          title: titleFromFileName(file.name),
          path: file.path,
          url: fileUrl(file.path),
          folderName,
          folderIndex,
          indexInFolder,
        }));
      groups.push({name: folderName, path: dirPath, startIndex, tracks});
      startIndex += tracks.length;
      total += tracks.length;
    }
    for (const dir of dirs) {
      await walk(dir.path, [...nameParts, dir.name], depth + 1);
    }
  };

  await walk(rootPath, [], 0);
  return groups;
}

export function flattenGroups(groups: FolderGroup[]): TrackInfo[] {
  return groups.flatMap(g => g.tracks);
}

export function totalTracks(groups: FolderGroup[]): number {
  return groups.reduce((sum, g) => sum + g.tracks.length, 0);
}
