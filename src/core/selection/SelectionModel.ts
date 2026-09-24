import {FolderGroup, Selection} from '../model';

/**
 * Reglas puras de la selección (cursor) sobre las carpetas: mover de pista en
 * pista (con salto entre carpetas), mover de carpeta en carpeta, calcular el
 * índice global de lo seleccionado y seguir a la pista que suena. Sin estado ni
 * dependencias de React: el componente guarda la `Selection` y llama a estos
 * métodos.
 */
export class SelectionModel {
  /** Mueve el cursor `delta` pistas; al pasarse, salta a la carpeta vecina. */
  moveTrack(
    current: Selection,
    delta: number,
    groups: FolderGroup[],
  ): Selection {
    if (groups.length === 0) {
      return current;
    }
    let {folder, track} = current;
    track += delta;
    if (track < 0) {
      folder = this.wrap(folder - 1, groups.length);
      track = groups[folder].tracks.length - 1;
    } else if (track >= groups[folder].tracks.length) {
      folder = this.wrap(folder + 1, groups.length);
      track = 0;
    }
    return {folder, track};
  }

  /** Mueve el cursor a la carpeta vecina (`delta`), en su primera pista. */
  moveFolder(
    current: Selection,
    delta: number,
    groups: FolderGroup[],
  ): Selection {
    if (groups.length === 0) {
      return current;
    }
    return {
      folder: this.wrap(current.folder + delta, groups.length),
      track: 0,
    };
  }

  /** Índice, en la cola global, de la pista seleccionada (acotado). */
  globalIndexOf(current: Selection, groups: FolderGroup[]): number {
    const group = groups[Math.min(current.folder, groups.length - 1)];
    const track = Math.max(0, Math.min(current.track, group.tracks.length - 1));
    return group.startIndex + track;
  }

  /** Índice global de la 1ª pista de la carpeta a `delta` de `fromFolder`. */
  folderOffsetStartIndex(
    fromFolder: number,
    delta: number,
    groups: FolderGroup[],
  ): number {
    const target = this.wrap(fromFolder + delta, groups.length);
    return groups[target].startIndex;
  }

  /** Selección que corresponde a la pista que está sonando. */
  fromActiveTrack(folderIndex: number, indexInFolder: number): Selection {
    return {folder: folderIndex, track: indexInFolder};
  }

  private wrap(value: number, length: number): number {
    return ((value % length) + length) % length;
  }
}
