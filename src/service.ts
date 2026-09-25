/**
 * Servicio de reproducción registrado en index.js. Delega en
 * `MediaSessionService`, que atiende los botones de la sesión de medios
 * (notificación, pantalla de bloqueo y controles Bluetooth) sobre el mismo
 * `PlaybackController` que usa la UI, y en `PlaybackKeepAwake`, que mantiene
 * despierto el equipo mientras suena música (aunque se apague la pantalla).
 */
import {playbackController} from './composition';
import {MediaSessionService} from './core/mediasession/MediaSessionService';
import {PlaybackKeepAwake} from './core/playback/PlaybackKeepAwake';
import {KeepAwake} from './native/KeepAwake';

export default async function playbackService(): Promise<void> {
  new MediaSessionService(playbackController).register();
  new PlaybackKeepAwake(KeepAwake).register();
}
