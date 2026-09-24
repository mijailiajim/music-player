/**
 * Servicio de reproducción registrado en index.js. Delega en
 * `MediaSessionService`, que atiende los botones de la sesión de medios
 * (notificación, pantalla de bloqueo y controles Bluetooth) sobre el mismo
 * `PlaybackController` que usa la UI.
 */
import {playbackController} from './composition';
import {MediaSessionService} from './core/mediasession/MediaSessionService';

export default async function playbackService(): Promise<void> {
  new MediaSessionService(playbackController).register();
}
