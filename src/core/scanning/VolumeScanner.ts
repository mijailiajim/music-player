import {DirEntry, FolderGroup, TrackInfo} from '../model';
import {AudioFilePolicy} from './AudioFilePolicy';
import {DirectoryLister} from './DirectoryLister';
import {FileUrlFactory} from './FileUrlFactory';
import {NameComparator} from './NameComparator';
import {SystemFolderFilter} from './SystemFolderFilter';

export const ROOT_FOLDER_NAME = 'Raíz del pendrive';

export interface ScanOptions {
  maxDepth?: number;
  maxTracks?: number;
}

/**
 * Recorre el árbol del pendrive y arma la cola de carpetas con música.
 *
 * Orden: primero los archivos de la raíz (alfabético), luego las carpetas en
 * orden alfabético; dentro de cada una, los archivos alfabéticos. Las
 * subcarpetas se recorren en profundidad, justo después de su carpeta madre.
 *
 * Colabora con piezas de responsabilidad única (política de audio, orden,
 * URLs, carpetas de sistema) y con un `DirectoryLister` inyectado.
 */
export class VolumeScanner {
  constructor(
    private readonly audio: AudioFilePolicy,
    private readonly order: NameComparator,
    private readonly urls: FileUrlFactory,
    private readonly systemFolders: SystemFolderFilter,
  ) {}

  async scan(
    rootPath: string,
    lister: DirectoryLister,
    options: ScanOptions = {},
  ): Promise<FolderGroup[]> {
    const maxDepth = options.maxDepth ?? 8;
    const maxTracks = options.maxTracks ?? 5000;
    const groups: FolderGroup[] = [];
    const state = {total: 0, startIndex: 0};
    await this.walk(
      rootPath,
      [],
      0,
      lister,
      groups,
      state,
      maxDepth,
      maxTracks,
    );
    return groups;
  }

  private async walk(
    dirPath: string,
    nameParts: string[],
    depth: number,
    lister: DirectoryLister,
    groups: FolderGroup[],
    state: {total: number; startIndex: number},
    maxDepth: number,
    maxTracks: number,
  ): Promise<void> {
    if (depth > maxDepth || state.total >= maxTracks) {
      return;
    }
    let entries: DirEntry[];
    try {
      entries = await lister.list(dirPath);
    } catch {
      return;
    }
    const visible = entries.filter(
      e => e.name.length > 0 && !e.name.startsWith('.'),
    );
    const files = visible
      .filter(e => !e.isDirectory && this.audio.isAudio(e.name))
      .sort((a, b) => this.order.compare(a.name, b.name));
    const dirs = visible
      .filter(e => e.isDirectory && !this.systemFolders.isSystem(e.name))
      .sort((a, b) => this.order.compare(a.name, b.name));

    if (files.length > 0) {
      const folderIndex = groups.length;
      const folderName =
        nameParts.length === 0 ? ROOT_FOLDER_NAME : nameParts.join(' / ');
      const tracks: TrackInfo[] = files
        .slice(0, Math.max(0, maxTracks - state.total))
        .map((file, indexInFolder) => ({
          title: this.audio.title(file.name),
          path: file.path,
          url: this.urls.from(file.path),
          folderName,
          folderIndex,
          indexInFolder,
        }));
      groups.push({
        name: folderName,
        path: dirPath,
        startIndex: state.startIndex,
        tracks,
      });
      state.startIndex += tracks.length;
      state.total += tracks.length;
    }
    for (const dir of dirs) {
      await this.walk(
        dir.path,
        [...nameParts, dir.name],
        depth + 1,
        lister,
        groups,
        state,
        maxDepth,
        maxTracks,
      );
    }
  }
}
