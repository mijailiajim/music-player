/**
 * Pista lista para la cola del reproductor, sin depender de la librería de
 * audio. El adaptador la entrega tal cual al motor (es estructuralmente
 * compatible con su tipo `Track`).
 */
export interface PlayableTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  album: string;
  folderIndex: number;
  indexInFolder: number;
}
