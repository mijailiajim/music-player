import {HoldDetector} from './HoldDetector';
import {RemoteActions} from './RemoteActions';
import {RemoteCommand} from './RemoteCommand';
import {RepeatWhileHeld} from './RepeatWhileHeld';
import {CURSOR_REPEAT_MS, HOLD_THRESHOLD_MS} from './timing';

/**
 * Flechas ▲ / ▼: mueven el cursor por la lista (−1 arriba, +1 abajo).
 * Mantenidas, siguen a 3 por segundo hasta el primero / el último; al soltar
 * queda seleccionado donde estaba.
 */
export class MoveCursorCommand implements RemoteCommand {
  private readonly repeat = new RepeatWhileHeld(CURSOR_REPEAT_MS);

  constructor(private readonly delta: number) {}

  execute(actions: RemoteActions): void {
    this.repeat.start(() => actions.moveCursor(this.delta));
  }

  release(): void {
    this.repeat.stop();
  }

  cancel(): void {
    this.repeat.stop();
  }
}

/**
 * Flechas ◀ / ▶. Un toque resalta y reproduce la canción anterior (−1) o
 * siguiente (+1) de la lista (en los extremos no hace nada). Mantenidas,
 * pausan y atrasan / adelantan la canción que suena 20 s por segundo; al
 * soltar sigue desde el segundo al que llegó.
 */
export class SkipOrScrubCommand implements RemoteCommand {
  private readonly hold = new HoldDetector(HOLD_THRESHOLD_MS);

  constructor(private readonly delta: number) {}

  execute(actions: RemoteActions): void {
    // Si se perdió el soltar anterior, se cierra lo que había quedado abierto.
    if (this.hold.release() === 'hold') {
      actions.finishScrub();
    }
    this.hold.press(() => actions.startScrub(this.delta));
  }

  release(actions: RemoteActions): void {
    const result = this.hold.release();
    if (result === 'tap') {
      actions.playAdjacent(this.delta);
    } else if (result === 'hold') {
      actions.finishScrub();
    }
  }

  cancel(): void {
    this.hold.reset();
  }
}

/**
 * Botón OK (redondo) del control: sobre una carpeta entra en ella; sobre una
 * canción la reproduce (si es la que ya suena, alterna pausa/play).
 */
export class OkButtonCommand implements RemoteCommand {
  execute(actions: RemoteActions): void {
    actions.activateSelection();
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

/**
 * Botón Home/retorno (BACK) del control: sube un nivel de carpeta, igual que
 * Re Pág. Ya no cierra la app.
 */
export class BackButtonCommand implements RemoteCommand {
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
