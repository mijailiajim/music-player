import {KeyCodes} from '../../keymap';
import {SEEK_STEP_SECONDS} from '../playback/constants';
import {RemoteActions} from './RemoteActions';
import {RemoteCommand} from './RemoteCommand';
import {
  BackButtonCommand,
  MoveCursorCommand,
  NextTrackCommand,
  OkButtonCommand,
  PageDownCommand,
  PageUpCommand,
  PauseCommand,
  PlayCommand,
  PlayFolderOffsetCommand,
  PreviousTrackCommand,
  SeekCommand,
  SkipOrScrubCommand,
  TogglePlayPauseCommand,
} from './commands';

/**
 * Traduce los códigos de tecla del control a comandos y los ejecuta contra las
 * `RemoteActions` de la app. El mapeo modela un explorador de archivos:
 *
 *   ▲ / ▼            mover el cursor (mantenidas: 3 por segundo; sin dar la vuelta)
 *   ◀ / ▶            canción anterior / siguiente (mantenidas: atrasar / adelantar)
 *   OK / Enter       entrar a la carpeta o reproducir la canción resaltada
 *                    (si ya suena: pausa/play)
 *   Re Pág / Av Pág  subir un nivel / entrar a la carpeta resaltada
 *   Home/retorno     subir un nivel (no cierra la app)
 *   Canal − / +      reproducir la carpeta anterior / siguiente
 *   multimedia       play/pausa, anterior/siguiente, adelantar/atrasar
 *
 * `press` y `release` llegan al apretar y al soltar; mantener apretado lo
 * resuelve cada comando con sus propios tiempos.
 */
export class RemoteControlRouter {
  private readonly bindings: Map<number, RemoteCommand>;

  constructor(private readonly actions: RemoteActions) {
    this.bindings = RemoteControlRouter.buildBindings();
  }

  press(keyCode: number): void {
    this.bindings.get(keyCode)?.execute(this.actions);
  }

  release(keyCode: number): void {
    this.bindings.get(keyCode)?.release?.(this.actions);
  }

  /** Corta todo lo que esté en curso (botones mantenidos). */
  cancelAll(): void {
    new Set(this.bindings.values()).forEach(command => command.cancel?.());
  }

  private static buildBindings(): Map<number, RemoteCommand> {
    const bindings = new Map<number, RemoteCommand>();
    const bind = (keys: number[], command: RemoteCommand) => {
      for (const key of keys) {
        bindings.set(key, command);
      }
    };

    bind([KeyCodes.DPAD_UP], new MoveCursorCommand(-1));
    bind([KeyCodes.DPAD_DOWN], new MoveCursorCommand(1));
    bind([KeyCodes.DPAD_LEFT], new SkipOrScrubCommand(-1));
    bind([KeyCodes.DPAD_RIGHT], new SkipOrScrubCommand(1));
    // Todas las teclas de confirmación: la del OK del control es una de ellas.
    bind(
      [
        KeyCodes.DPAD_CENTER,
        KeyCodes.ENTER,
        KeyCodes.NUMPAD_ENTER,
        KeyCodes.SPACE,
        KeyCodes.BUTTON_SELECT,
        KeyCodes.BUTTON_A,
      ],
      new OkButtonCommand(),
    );
    bind(
      [KeyCodes.MEDIA_PLAY_PAUSE, KeyCodes.HEADSETHOOK],
      new TogglePlayPauseCommand(),
    );
    bind([KeyCodes.MEDIA_PLAY], new PlayCommand());
    bind([KeyCodes.MEDIA_PAUSE, KeyCodes.MEDIA_STOP], new PauseCommand());
    bind([KeyCodes.MEDIA_NEXT], new NextTrackCommand());
    bind([KeyCodes.MEDIA_PREVIOUS], new PreviousTrackCommand());
    bind([KeyCodes.MEDIA_FAST_FORWARD], new SeekCommand(SEEK_STEP_SECONDS));
    bind([KeyCodes.MEDIA_REWIND], new SeekCommand(-SEEK_STEP_SECONDS));
    bind([KeyCodes.CHANNEL_UP], new PlayFolderOffsetCommand(1));
    bind([KeyCodes.CHANNEL_DOWN], new PlayFolderOffsetCommand(-1));
    bind([KeyCodes.PAGE_UP], new PageUpCommand());
    bind([KeyCodes.PAGE_DOWN], new PageDownCommand());
    bind([KeyCodes.BACK], new BackButtonCommand());

    return bindings;
  }
}
