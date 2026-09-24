import {FolderGroup, TrackInfo} from '../model';

/**
 * Consultas sobre el conjunto de carpetas con música (la cola): aplanarla,
 * contar pistas y ubicar posiciones dentro de ella. Responsabilidad única
 * sobre la colección.
 */
export class MusicLibrary {
  constructor(private readonly groups: FolderGroup[]) {}

  flatten(): TrackInfo[] {
    return this.groups.flatMap(g => g.tracks);
  }

  get totalTracks(): number {
    return this.groups.reduce((sum, g) => sum + g.tracks.length, 0);
  }

  get isEmpty(): boolean {
    return this.totalTracks === 0;
  }

  /** Posición de la pista en la cola global. */
  queueIndexOf(track: TrackInfo): number {
    return this.groups[track.folderIndex].startIndex + track.indexInFolder;
  }

  /** Posición en la cola de la 1ª pista de la carpeta a `delta` de `from`. */
  folderOffsetStartIndex(from: number, delta: number): number {
    const count = this.groups.length;
    const target = (((from + delta) % count) + count) % count;
    return this.groups[target].startIndex;
  }
}
