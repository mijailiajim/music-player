/**
 * Raíz de composición: arma las instancias compartidas de la capa de
 * reproducción. Tanto la fachada `player.ts` (que usa la UI) como el servicio
 * de la sesión de medios operan sobre el MISMO controlador y motor.
 */
import {TrackPlayerAudioPlayer} from './adapters/TrackPlayerAudioPlayer';
import {PlaybackController} from './core/playback/PlaybackController';
import {QueueFactory} from './core/playback/QueueFactory';

export const audioPlayer = new TrackPlayerAudioPlayer();

export const playbackController = new PlaybackController(
  audioPlayer,
  new QueueFactory(),
);
