import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  RepeatMode,
  State,
  Track,
} from 'react-native-track-player';
import {flattenGroups, FolderGroup} from './library';

/** Track de la cola con los metadatos de carpeta que agrega esta app. */
export interface QueueTrack extends Track {
  folderIndex: number;
  indexInFolder: number;
}

export const SEEK_STEP_SECONDS = 10;

let setupPromise: Promise<void> | null = null;

export function setupPlayerOnce(): Promise<void> {
  if (!setupPromise) {
    setupPromise = doSetup().catch(error => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}

async function doSetup(): Promise<void> {
  try {
    await TrackPlayer.setupPlayer({autoHandleInterruptions: true});
  } catch (error) {
    if (!String(error).includes('already been initialized')) {
      throw error;
    }
  }
  await TrackPlayer.updateOptions({
    android: {
      appKilledPlaybackBehavior:
        AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
    },
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
      Capability.JumpForward,
      Capability.JumpBackward,
      Capability.Stop,
    ],
    compactCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],
    forwardJumpInterval: SEEK_STEP_SECONDS,
    backwardJumpInterval: SEEK_STEP_SECONDS,
    progressUpdateEventInterval: 1,
  });
  // Al terminar el último tema del pendrive vuelve a empezar por el primero.
  await TrackPlayer.setRepeatMode(RepeatMode.Queue);
}

export async function loadQueue(
  groups: FolderGroup[],
  autoplay: boolean,
): Promise<void> {
  const tracks: QueueTrack[] = flattenGroups(groups).map(t => ({
    id: t.path,
    url: t.url,
    title: t.title,
    artist: t.folderName,
    album: t.folderName,
    folderIndex: t.folderIndex,
    indexInFolder: t.indexInFolder,
  }));
  await TrackPlayer.reset();
  if (tracks.length === 0) {
    return;
  }
  await TrackPlayer.add(tracks);
  if (autoplay) {
    await TrackPlayer.play();
  }
}

export async function clearQueue(): Promise<void> {
  try {
    await TrackPlayer.reset();
  } catch {}
}

export async function playTrackAt(globalIndex: number): Promise<void> {
  try {
    await TrackPlayer.skip(globalIndex);
    await TrackPlayer.play();
  } catch {}
}

export async function togglePlayPause(): Promise<void> {
  try {
    const {state} = await TrackPlayer.getPlaybackState();
    if (state === State.Playing || state === State.Buffering) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  } catch {}
}

export async function skipToNext(): Promise<void> {
  try {
    await TrackPlayer.skipToNext();
    await TrackPlayer.play();
  } catch {}
}

export async function skipToPrevious(): Promise<void> {
  try {
    await TrackPlayer.skipToPrevious();
    await TrackPlayer.play();
  } catch {}
}

export async function seekBy(offsetSeconds: number): Promise<void> {
  try {
    const progress = await TrackPlayer.getProgress();
    const target = Math.max(0, progress.position + offsetSeconds);
    await TrackPlayer.seekTo(
      progress.duration > 0 ? Math.min(target, progress.duration) : target,
    );
  } catch {}
}

export function isPlayingState(state: State | undefined): boolean {
  return (
    state === State.Playing ||
    state === State.Buffering ||
    state === State.Loading
  );
}

export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
