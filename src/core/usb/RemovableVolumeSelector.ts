import {StorageVolumeInfo} from '../model';

/**
 * Responsabilidad única: elegir, entre los volúmenes montados, el pendrive a
 * reproducir — el extraíble montado que no sea el almacenamiento interno.
 */
export class RemovableVolumeSelector {
  pick(volumes: StorageVolumeInfo[]): StorageVolumeInfo | undefined {
    return (
      volumes.find(v => v.removable && !v.primary && v.state === 'mounted') ??
      volumes.find(v => v.removable && v.state === 'mounted')
    );
  }
}
