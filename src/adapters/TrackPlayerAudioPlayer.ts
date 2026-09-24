import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  RepeatMode,
  State,
} from 'react-native-track-player';
import {
  AudioPlayerPort,
  PlaybackProgress,
} from '../core/playback/AudioPlayerPort';
import {SEEK_STEP_SECONDS} from '../core/playback/constants';
import {PlayableTrack} from '../core/playback/PlayableTrack';

/**
 * Adaptador que implementa el puerto de reproducción con
 * react-native-track-player. Es el único lugar que conoce esa librería.
 */
export class TrackPlayerAudioPlayer implements AudioPlayerPort {
  async setup(): Promise<void> {
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

  reset(): Promise<void> {
    return TrackPlayer.reset();
  }

  async add(tracks: PlayableTrack[]): Promise<void> {
    await TrackPlayer.add(tracks);
  }

  play(): Promise<void> {
    return TrackPlayer.play();
  }

  pause(): Promise<void> {
    return TrackPlayer.pause();
  }

  skipTo(index: number): Promise<void> {
    return TrackPlayer.skip(index);
  }

  skipToNext(): Promise<void> {
    return TrackPlayer.skipToNext();
  }

  skipToPrevious(): Promise<void> {
    return TrackPlayer.skipToPrevious();
  }

  seekTo(seconds: number): Promise<void> {
    return TrackPlayer.seekTo(seconds);
  }

  async getProgress(): Promise<PlaybackProgress> {
    const progress = await TrackPlayer.getProgress();
    return {position: progress.position, duration: progress.duration};
  }

  async isActive(): Promise<boolean> {
    const {state} = await TrackPlayer.getPlaybackState();
    return state === State.Playing || state === State.Buffering;
  }
}
