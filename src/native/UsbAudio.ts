import {NativeModules, Platform} from 'react-native';
import type {DirEntry} from '../library';

export interface StorageVolumeInfo {
  path: string;
  description: string;
  removable: boolean;
  primary: boolean;
  state: string;
}

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

/** Elige el volumen a reproducir: el extraíble montado que no sea el interno. */
export function pickUsbVolume(
  volumes: StorageVolumeInfo[],
): StorageVolumeInfo | undefined {
  return (
    volumes.find(v => v.removable && !v.primary && v.state === 'mounted') ??
    volumes.find(v => v.removable && v.state === 'mounted')
  );
}
