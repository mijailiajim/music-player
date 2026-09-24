import {MusicLibrary} from '../library/MusicLibrary';
import {FolderGroup} from '../model';
import {PlayableTrack} from './PlayableTrack';

/**
 * Responsabilidad única: convertir las carpetas escaneadas en la cola lineal de
 * pistas que consume el reproductor (en el orden global ya calculado).
 */
export class QueueFactory {
  build(groups: FolderGroup[]): PlayableTrack[] {
    return new MusicLibrary(groups).flatten().map(track => ({
      id: track.path,
      url: track.url,
      title: track.title,
      artist: track.folderName,
      album: track.folderName,
      folderIndex: track.folderIndex,
      indexInFolder: track.indexInFolder,
    }));
  }
}
