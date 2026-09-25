/**
 * Adaptador del módulo nativo `KeepAwake` (Kotlin): mantiene despierto el
 * equipo mientras suena música. Es el único punto de la app que habla con
 * `NativeModules.KeepAwake`. (Que la pantalla no se apague mientras se ve la
 * app no pasa por acá: lo hace MainActivity al crearse.)
 */
import {NativeModules, Platform} from 'react-native';
import type {KeepAwakePort} from '../core/playback/PlaybackKeepAwake';

interface KeepAwakeNative {
  setPlaybackAwake(awake: boolean): void;
}

const native: KeepAwakeNative | null =
  Platform.OS === 'android' && NativeModules.KeepAwake
    ? (NativeModules.KeepAwake as KeepAwakeNative)
    : null;

export const KeepAwake: KeepAwakePort = {
  setPlaybackAwake(awake: boolean): void {
    native?.setPlaybackAwake(awake);
  },
};
