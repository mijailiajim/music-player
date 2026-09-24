import {RemoteActions} from './RemoteActions';
import {RemoteCommand} from './RemoteCommand';

/** Mueve el cursor por las pistas (−1 arriba, +1 abajo). */
export class MoveCursorCommand implements RemoteCommand {
  constructor(private readonly delta: number) {}
  execute(actions: RemoteActions): void {
    actions.moveCursor(this.delta);
  }
}

/** Mueve el cursor entre carpetas (−1 anterior, +1 siguiente). */
export class MoveFolderCommand implements RemoteCommand {
  constructor(private readonly delta: number) {}
  execute(actions: RemoteActions): void {
    actions.moveFolder(this.delta);
  }
}

/** Reproduce la pista seleccionada. */
export class PlaySelectionCommand implements RemoteCommand {
  execute(actions: RemoteActions): void {
    actions.playSelection();
  }
}

/** Reproduce la 1ª pista de la carpeta a `delta` de la que suena. */
export class PlayFolderOffsetCommand implements RemoteCommand {
  constructor(private readonly delta: number) {}
  execute(actions: RemoteActions): void {
    actions.playFolderOffset(this.delta);
  }
}

/** Alterna play/pausa. */
export class TogglePlayPauseCommand implements RemoteCommand {
  execute(actions: RemoteActions): void {
    actions.togglePlayPause();
  }
}

/** Reanuda la reproducción. */
export class PlayCommand implements RemoteCommand {
  execute(actions: RemoteActions): void {
    actions.play();
  }
}

/** Pausa la reproducción. */
export class PauseCommand implements RemoteCommand {
  execute(actions: RemoteActions): void {
    actions.pause();
  }
}

/** Salta a la pista siguiente. */
export class NextTrackCommand implements RemoteCommand {
  execute(actions: RemoteActions): void {
    actions.nextTrack();
  }
}

/** Salta a la pista anterior. */
export class PreviousTrackCommand implements RemoteCommand {
  execute(actions: RemoteActions): void {
    actions.previousTrack();
  }
}

/** Adelanta (positivo) o atrasa (negativo) `seconds` segundos. */
export class SeekCommand implements RemoteCommand {
  constructor(private readonly seconds: number) {}
  execute(actions: RemoteActions): void {
    actions.seekBy(this.seconds);
  }
}
