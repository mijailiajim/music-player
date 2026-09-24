import {KeyCodes} from '../../keymap';
import {SEEK_STEP_SECONDS} from '../playback/constants';
import {RemoteActions} from './RemoteActions';
import {RemoteCommand} from './RemoteCommand';
import {
  MoveCursorCommand,
  MoveFolderCommand,
  NextTrackCommand,
  PauseCommand,
  PlayCommand,
  PlayFolderOffsetCommand,
  PlaySelectionCommand,
  PreviousTrackCommand,
  SeekCommand,
  TogglePlayPauseCommand,
} from './commands';

/**
 * Traduce los códigos de tecla del control a comandos y los ejecuta contra las
 * `RemoteActions` de la app. El mapeo modela un explorador de archivos:
 *
 *   ▲ / ▼            mover el cursor
 *   ◀ / ▶            cambiar de carpeta
 *   OK / Enter       reproducir lo seleccionado
 *   Av Pág / Re Pág  reproducir la carpeta siguiente / anterior
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
    bind([KeyCodes.DPAD_LEFT], new MoveFolderCommand(-1));
    bind([KeyCodes.DPAD_RIGHT], new MoveFolderCommand(1));
    bind(
      [
        KeyCodes.DPAD_CENTER,
        KeyCodes.ENTER,
        KeyCodes.NUMPAD_ENTER,
        KeyCodes.BUTTON_SELECT,
        KeyCodes.BUTTON_A,
      ],
      new PlaySelectionCommand(),
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
    bind(
      [KeyCodes.CHANNEL_UP, KeyCodes.PAGE_DOWN],
      new PlayFolderOffsetCommand(1),
    );
    bind(
      [KeyCodes.CHANNEL_DOWN, KeyCodes.PAGE_UP],
      new PlayFolderOffsetCommand(-1),
    );

    return bindings;
  }
}
