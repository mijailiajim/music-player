/**
 * Adaptador del módulo nativo `UsbAudio` (Kotlin): volúmenes montados, listado
 * de directorios, permisos de almacenamiento y volumen del sistema. Es el único
 * punto de la app que habla con `NativeModules.UsbAudio`. La elección del
 * pendrive vive en `RemovableVolumeSelector` (núcleo).
 */
import {NativeModules, Platform} from 'react-native';
import type {DirEntry, StorageVolumeInfo} from '../core/model';

export type {StorageVolumeInfo};

interface UsbAudioNative {
  getVolumes(): Promise<StorageVolumeInfo[]>;
  listDir(path: string): Promise<DirEntry[]>;
  hasStorageAccess(): Promise<boolean>;
  requestStorageAccess(): Promise<boolean>;
  adjustVolume(direction: number): void;
}

const native: UsbAudioNative | null =
  Platform.OS === 'android' && NativeModules.UsbAudio
    ? (NativeModules.UsbAudio as UsbAudioNative)
    : null;

export const UsbAudio = {
  isAvailable: native != null,

  getVolumes(): Promise<StorageVolumeInfo[]> {
    return native ? native.getVolumes() : Promise.resolve([]);
  },

  listDir(path: string): Promise<DirEntry[]> {
    return native ? native.listDir(path) : Promise.resolve([]);
  },

  hasStorageAccess(): Promise<boolean> {
    return native ? native.hasStorageAccess() : Promise.resolve(false);
  },

  requestStorageAccess(): Promise<boolean> {
    return native ? native.requestStorageAccess() : Promise.resolve(false);
  },

  volumeUp(): void {
    native?.adjustVolume(1);
  },

  volumeDown(): void {
    native?.adjustVolume(-1);
  },
};
