import TrackPlayer, {Event, State} from 'react-native-track-player';
import {SEEK_STEP_SECONDS} from '../playback/constants';
import {PlaybackController} from '../playback/PlaybackController';

/** Tope de saltos ante archivos ilegibles seguidos (evita ciclar infinito). */
const MAX_CONSECUTIVE_ERRORS = 25;

/**
 * Atiende los botones que llegan por la sesión de medios (notificación,
 * pantalla de bloqueo y controles Bluetooth: control remoto, auriculares,
 * autoestéreo) delegando en el `PlaybackController`.
 */
export class MediaSessionService {
  private consecutiveErrors = 0;

  constructor(private readonly playback: PlaybackController) {}

  register(): void {
    TrackPlayer.addEventListener(Event.RemotePlay, () =>
      this.playback.resume(),
    );
    TrackPlayer.addEventListener(Event.RemotePause, () =>
      this.playback.pause(),
    );
    TrackPlayer.addEventListener(Event.RemoteStop, () => this.playback.pause());
    TrackPlayer.addEventListener(Event.RemoteNext, () =>
      this.playback.skipToNext(),
    );
    TrackPlayer.addEventListener(Event.RemotePrevious, () =>
      this.playback.skipToPrevious(),
    );
    TrackPlayer.addEventListener(Event.RemoteSeek, event =>
      this.playback.seekToPosition(event.position),
    );
    TrackPlayer.addEventListener(Event.RemoteJumpForward, event =>
      this.playback.seekBy(event.interval ?? SEEK_STEP_SECONDS),
    );
    TrackPlayer.addEventListener(Event.RemoteJumpBackward, event =>
      this.playback.seekBy(-(event.interval ?? SEEK_STEP_SECONDS)),
    );
    TrackPlayer.addEventListener(Event.RemoteDuck, event => {
      if (event.permanent || event.paused) {
        this.playback.pause();
      }
    });
    TrackPlayer.addEventListener(Event.PlaybackState, event => {
      if (event.state === State.Playing) {
        this.consecutiveErrors = 0;
      }
    });
    // Archivo ilegible/corrupto: se salta al siguiente, con tope para no ciclar
    // infinitamente si todo el pendrive es ilegible.
    TrackPlayer.addEventListener(Event.PlaybackError, async () => {
      this.consecutiveErrors += 1;
      if (this.consecutiveErrors > MAX_CONSECUTIVE_ERRORS) {
        return;
      }
      await this.playback.skipToNext();
    });
  }
}
