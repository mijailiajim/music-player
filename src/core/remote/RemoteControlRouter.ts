import {KeyCodes} from '../../keymap';
import {SEEK_STEP_SECONDS} from '../playback/constants';
import {RemoteActions} from './RemoteActions';
import {RemoteCommand} from './RemoteCommand';
import {
  MoveCursorCommand,
  NextTrackCommand,
  OkButtonCommand,
  PageDownCommand,
  PageUpCommand,
  PauseCommand,
  PlayCommand,
  PlayAdjacentTrackCommand,
  PlayFolderOffsetCommand,
  PreviousTrackCommand,
  SeekCommand,
  TogglePlayPauseCommand,
} from './commands';

/**
 * Traduce los códigos de tecla del control a comandos y los ejecuta contra las
 * `RemoteActions` de la app. El mapeo modela un explorador de archivos:
 *
 *   ▲ / ▼            mover el cursor (sin dar la vuelta)
 *   ◀ / ▶            reproducir la canción anterior / siguiente de la lista
 *   OK / Enter       reproducir la canción resaltada
 *   Re Pág / Av Pág  subir un nivel / entrar a la carpeta resaltada
 *   Canal − / +      reproducir la carpeta anterior / siguiente
 *   multimedia       play/pausa, anterior/siguiente, adelantar/atrasar
 */
export class RemoteControlRouter {
  private readonly bindings: Map<number, RemoteCommand>;

  constructor(private readonly actions: RemoteActions) {
    this.bindings = RemoteControlRouter.buildBindings();
  }

  handle(keyCode: number): void {
    const command = this.bindings.get(keyCode);
    if (command) {
      command.execute(this.actions);
    }
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
    bind([KeyCodes.DPAD_LEFT], new PlayAdjacentTrackCommand(-1));
    bind([KeyCodes.DPAD_RIGHT], new PlayAdjacentTrackCommand(1));
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

    return bindings;
  }
}
