import {FolderNode, TrackInfo} from '../model';

/** Qué se está mirando: la carpeta abierta y el ítem resaltado. */
export interface BrowseState {
  /** Ruta de la carpeta abierta. */
  dir: string;
  /** Posición del cursor en la lista de esa carpeta. */
  cursor: number;
}

/** Ítem de la lista de una carpeta: una subcarpeta o una canción. */
export type BrowserItem =
  | {kind: 'folder'; folder: FolderNode}
  | {kind: 'track'; track: TrackInfo};

/**
 * Reglas puras del navegador de carpetas del pendrive (sin estado ni React:
 * el componente guarda el `BrowseState` y llama a estos métodos). Cada carpeta
 * lista primero TODAS sus subcarpetas, tengan o no música, y después solo sus
 * canciones reproducibles.
 *
 *  - ▲ / ▼: mueven el cursor; en los extremos no dan la vuelta.
 *  - Av Pág: entra a la carpeta resaltada. Re Pág: sube un nivel.
 *  - ◀ / ▶: la canción anterior / siguiente de la lista; en los extremos, nada.
 */
export class FolderBrowser {
  private readonly folders = new Map<string, FolderNode>();
  private readonly parents = new Map<string, FolderNode>();
  private readonly trackFolders = new Map<string, FolderNode>();

  constructor(readonly root: FolderNode) {
    this.index(root);
  }

  /** La raíz, con el cursor arriba. */
  start(): BrowseState {
    return {dir: this.root.path, cursor: 0};
  }

  /** La carpeta abierta (la raíz si esa ruta ya no existe). */
  folderOf(state: BrowseState): FolderNode {
    return this.folders.get(state.dir) ?? this.root;
  }

  /** Lista de la carpeta abierta: primero las subcarpetas, después las canciones. */
  items(state: BrowseState): BrowserItem[] {
    const folder = this.folderOf(state);
    return [
      ...folder.folders.map(f => ({kind: 'folder' as const, folder: f})),
      ...folder.tracks.map(t => ({kind: 'track' as const, track: t})),
    ];
  }

  selected(state: BrowseState): BrowserItem | undefined {
    return this.items(state)[state.cursor];
  }

  /** Hay una carpeta arriba de la abierta. */
  canGoUp(state: BrowseState): boolean {
    return this.parents.has(this.folderOf(state).path);
  }

  /** ▲ / ▼: mueve el cursor `delta` ítems, sin pasarse de los extremos. */
  moveCursor(state: BrowseState, delta: number): BrowseState {
    const last = this.items(state).length - 1;
    if (last < 0) {
      return state;
    }
    const cursor = Math.max(0, Math.min(last, state.cursor + delta));
    return cursor === state.cursor ? state : {dir: state.dir, cursor};
  }

  /** Av Pág: entra a la carpeta resaltada; sobre una canción no hace nada. */
  enter(state: BrowseState): BrowseState {
    const item = this.selected(state);
    return item?.kind === 'folder' ? {dir: item.folder.path, cursor: 0} : state;
  }

  /** Re Pág: sube un nivel, con el cursor en la carpeta de la que se sale. */
  up(state: BrowseState): BrowseState {
    const folder = this.folderOf(state);
    const parent = this.parents.get(folder.path);
    if (!parent) {
      return state;
    }
    return {dir: parent.path, cursor: parent.folders.indexOf(folder)};
  }

  /**
   * ◀ / ▶: la canción anterior (`delta` < 0) o siguiente (`delta` > 0) a la
   * resaltada, salteando subcarpetas. null si no hay (está en un extremo).
   */
  adjacentTrack(
    state: BrowseState,
    delta: number,
  ): {state: BrowseState; track: TrackInfo} | null {
    const step = Math.sign(delta);
    const items = this.items(state);
    for (
      let i = state.cursor + step;
      step !== 0 && i >= 0 && i < items.length;
      i += step
    ) {
      const item = items[i];
      if (item.kind === 'track') {
        return {
          state: {dir: this.folderOf(state).path, cursor: i},
          track: item.track,
        };
      }
    }
    return null;
  }

  /** Abre la carpeta de la canción `trackPath`, con esa canción resaltada. */
  reveal(trackPath: string): BrowseState | null {
    const folder = this.trackFolders.get(trackPath);
    if (!folder) {
      return null;
    }
    const index = folder.tracks.findIndex(t => t.path === trackPath);
    return {dir: folder.path, cursor: folder.folders.length + index};
  }

  private index(folder: FolderNode): void {
    this.folders.set(folder.path, folder);
    for (const track of folder.tracks) {
      this.trackFolders.set(track.path, folder);
    }
    for (const child of folder.folders) {
      this.parents.set(child.path, folder);
      this.index(child);
    }
  }
}
