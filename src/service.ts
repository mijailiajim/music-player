import TrackPlayer, {Event, State} from 'react-native-track-player';
import {seekBy, SEEK_STEP_SECONDS, skipToNext, skipToPrevious} from './player';

/**
 * Servicio de reproducción de react-native-track-player. Atiende los botones
 * multimedia que llegan por MediaSession: notificación, pantalla de bloqueo y
 * controles Bluetooth (control remoto, auriculares, autoestéreo).
 */
export default async function playbackService(): Promise<void> {
  let consecutiveErrors = 0;

  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, event =>
    TrackPlayer.seekTo(event.position),
  );
  TrackPlayer.addEventListener(Event.RemoteJumpForward, event =>
    seekBy(event.interval ?? SEEK_STEP_SECONDS),
  );
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, event =>
    seekBy(-(event.interval ?? SEEK_STEP_SECONDS)),
  );
  TrackPlayer.addEventListener(Event.RemoteDuck, event => {
    if (event.permanent || event.paused) {
      TrackPlayer.pause();
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackState, event => {
    if (event.state === State.Playing) {
      consecutiveErrors = 0;
    }
  });

  // Archivo ilegible/corrupto: se salta al siguiente, con tope para no
  // ciclar infinitamente si todo el pendrive es ilegible.
  TrackPlayer.addEventListener(Event.PlaybackError, async () => {
    consecutiveErrors += 1;
    if (consecutiveErrors > 25) {
      return;
    }
    try {
      await TrackPlayer.skipToNext();
      await TrackPlayer.play();
    } catch {}
  });
}
