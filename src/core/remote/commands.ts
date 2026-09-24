import {RemoteActions} from './RemoteActions';
import {RemoteCommand} from './RemoteCommand';

/** Flechas ▲ / ▼: mueven el cursor por la lista (−1 arriba, +1 abajo). */
export class MoveCursorCommand implements RemoteCommand {
  constructor(private readonly delta: number) {}
  execute(actions: RemoteActions): void {
    actions.moveCursor(this.delta);
  }
}

/**
 * Flechas ◀ / ▶: resaltan y reproducen la canción anterior (−1) o siguiente
 * (+1) de la lista; en los extremos no hacen nada.
 */
export class PlayAdjacentTrackCommand implements RemoteCommand {
  constructor(private readonly delta: number) {}
  execute(actions: RemoteActions): void {
    actions.playAdjacent(this.delta);
  }
}

/** Botón OK (redondo) del control: reproduce la canción resaltada. */
export class OkButtonCommand implements RemoteCommand {
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

/** Botón Re Pág (Page ▲) del control: sube un nivel de carpeta. */
export class PageUpCommand implements RemoteCommand {
  execute(actions: RemoteActions): void {
    actions.goUp();
  }
}

/** Botón Av Pág (Page ▼) del control: entra a la carpeta resaltada. */
export class PageDownCommand implements RemoteCommand {
  execute(actions: RemoteActions): void {
    actions.enterFolder();
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
