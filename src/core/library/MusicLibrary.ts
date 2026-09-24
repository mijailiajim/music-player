import {FolderGroup, TrackInfo} from '../model';

/**
 * Consultas sobre el conjunto de carpetas escaneadas: aplanar a una cola lineal
 * y contar el total de pistas. Responsabilidad única sobre la colección.
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
}
