/**
 * Router del control remoto: a qué clase va cada botón, qué le pide a la app
 * al apretar y al soltar, y qué pasa si se mantiene apretado.
 */
import {RemoteActions} from '../src/core/remote/RemoteActions';
import {RemoteControlRouter} from '../src/core/remote/RemoteControlRouter';
import {
  BackButtonCommand,
  OkButtonCommand,
  PageDownCommand,
  PageUpCommand,
  SkipOrScrubCommand,
} from '../src/core/remote/commands';
import {CURSOR_REPEAT_MS, HOLD_THRESHOLD_MS} from '../src/core/remote/timing';
import {KeyCodes} from '../src/keymap';

function mockActions(): jest.Mocked<RemoteActions> {
  return {
    moveCursor: jest.fn().mockReturnValue(true),
    playAdjacent: jest.fn(),
    activateSelection: jest.fn(),
    startScrub: jest.fn(),
    finishScrub: jest.fn(),
    goUp: jest.fn(),
    enterFolder: jest.fn(),
    playFolderOffset: jest.fn(),
    togglePlayPause: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    nextTrack: jest.fn(),
    previousTrack: jest.fn(),
    seekBy: jest.fn(),
  };
}

/** Apretar y soltar enseguida (un toque). */
function tap(router: RemoteControlRouter, keyCode: number) {
  router.press(keyCode);
  router.release(keyCode);
}

/** Lo que pidió el botón: solo `expected`, una vez y con `args`. */
function expectOnly(
  actions: jest.Mocked<RemoteActions>,
  expected: keyof RemoteActions,
  ...args: unknown[]
) {
  for (const [name, action] of Object.entries(actions)) {
    if (name === expected) {
      expect(action).toHaveBeenCalledTimes(1);
      expect(action).toHaveBeenCalledWith(...args);
    } else {
      expect(action).not.toHaveBeenCalled();
    }
  }
}

function expectNothing(actions: jest.Mocked<RemoteActions>) {
  Object.values(actions).forEach(action =>
    expect(action).not.toHaveBeenCalled(),
  );
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('OK: entra a la carpeta o reproduce la canción (si ya suena, pausa/play)', () => {
  it.each([
    ['DPAD_CENTER', KeyCodes.DPAD_CENTER],
    ['ENTER', KeyCodes.ENTER],
    ['NUMPAD_ENTER', KeyCodes.NUMPAD_ENTER],
    ['SPACE', KeyCodes.SPACE],
    ['BUTTON_SELECT', KeyCodes.BUTTON_SELECT],
    ['BUTTON_A', KeyCodes.BUTTON_A],
  ])('%s → OkButtonCommand → activateSelection', (_name, keyCode) => {
    const spy = jest.spyOn(OkButtonCommand.prototype, 'execute');
    const actions = mockActions();
    tap(new RemoteControlRouter(actions), keyCode);
    expect(spy).toHaveBeenCalledTimes(1);
    expectOnly(actions, 'activateSelection');
  });
});

describe('Re Pág, Av Pág y Home/retorno: navegan las carpetas', () => {
  it('PAGE_UP → PageUpCommand → sube un nivel', () => {
    const spy = jest.spyOn(PageUpCommand.prototype, 'execute');
    const actions = mockActions();
    tap(new RemoteControlRouter(actions), KeyCodes.PAGE_UP);
    expect(spy).toHaveBeenCalledTimes(1);
    expectOnly(actions, 'goUp');
  });

  it('PAGE_DOWN → PageDownCommand → entra a la carpeta', () => {
    const spy = jest.spyOn(PageDownCommand.prototype, 'execute');
    const actions = mockActions();
    tap(new RemoteControlRouter(actions), KeyCodes.PAGE_DOWN);
    expect(spy).toHaveBeenCalledTimes(1);
    expectOnly(actions, 'enterFolder');
  });

  it('BACK (Home/retorno) → BackButtonCommand → sube un nivel', () => {
    const spy = jest.spyOn(BackButtonCommand.prototype, 'execute');
    const actions = mockActions();
    tap(new RemoteControlRouter(actions), KeyCodes.BACK);
    expect(spy).toHaveBeenCalledTimes(1);
    expectOnly(actions, 'goUp');
  });
});

describe('▲ / ▼', () => {
  it.each([
    ['DPAD_UP', KeyCodes.DPAD_UP, -1],
    ['DPAD_DOWN', KeyCodes.DPAD_DOWN, 1],
  ])('%s: un toque mueve el cursor una vez (%i)', (_name, keyCode, delta) => {
    const actions = mockActions();
    tap(new RemoteControlRouter(actions), keyCode);
    jest.advanceTimersByTime(3000);
    expectOnly(actions, 'moveCursor', delta);
  });

  it('mantenida sigue a 3 por segundo; al soltar se detiene', () => {
    const actions = mockActions();
    const router = new RemoteControlRouter(actions);
    router.press(KeyCodes.DPAD_DOWN);
    expect(actions.moveCursor).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(actions.moveCursor).toHaveBeenCalledTimes(1 + 3);
    jest.advanceTimersByTime(1000);
    expect(actions.moveCursor).toHaveBeenCalledTimes(1 + 6);
    expect(CURSOR_REPEAT_MS).toBeCloseTo(1000 / 3);

    router.release(KeyCodes.DPAD_DOWN);
    jest.advanceTimersByTime(3000);
    expect(actions.moveCursor).toHaveBeenCalledTimes(1 + 6);
    expect(actions.moveCursor).toHaveBeenLastCalledWith(1);
  });

  it('mantenida se detiene sola al llegar al extremo', () => {
    const actions = mockActions();
    // Puede moverse 2 veces más; la tercera ya está en la primera.
    actions.moveCursor
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    new RemoteControlRouter(actions).press(KeyCodes.DPAD_UP);
    jest.advanceTimersByTime(5000);
    expect(actions.moveCursor).toHaveBeenCalledTimes(3);
  });
});

describe('◀ / ▶', () => {
  it.each([
    ['DPAD_LEFT', KeyCodes.DPAD_LEFT, -1],
    ['DPAD_RIGHT', KeyCodes.DPAD_RIGHT, 1],
  ])('%s: un toque → canción vecina (%i)', (_name, keyCode, delta) => {
    const spy = jest.spyOn(SkipOrScrubCommand.prototype, 'execute');
    const actions = mockActions();
    const router = new RemoteControlRouter(actions);
    router.press(keyCode);
    jest.advanceTimersByTime(HOLD_THRESHOLD_MS - 100);
    router.release(keyCode);
    expect(spy).toHaveBeenCalledTimes(1);
    expectOnly(actions, 'playAdjacent', delta);
  });

  it.each([
    ['DPAD_LEFT', KeyCodes.DPAD_LEFT, -1],
    ['DPAD_RIGHT', KeyCodes.DPAD_RIGHT, 1],
  ])(
    '%s: mantenida → atrasa/adelanta (%i) y al soltar sigue la reproducción',
    (_name, keyCode, delta) => {
      const actions = mockActions();
      const router = new RemoteControlRouter(actions);
      router.press(keyCode);
      jest.advanceTimersByTime(HOLD_THRESHOLD_MS);
      expectOnly(actions, 'startScrub', delta);

      jest.advanceTimersByTime(3000);
      expect(actions.startScrub).toHaveBeenCalledTimes(1);

      router.release(keyCode);
      expect(actions.finishScrub).toHaveBeenCalledTimes(1);
      expect(actions.playAdjacent).not.toHaveBeenCalled();
    },
  );

  it('si se perdió el soltar, la siguiente pulsación cierra el adelanto', () => {
    const actions = mockActions();
    const router = new RemoteControlRouter(actions);
    router.press(KeyCodes.DPAD_RIGHT);
    jest.advanceTimersByTime(HOLD_THRESHOLD_MS);
    router.press(KeyCodes.DPAD_RIGHT); // sin soltar antes
    expect(actions.finishScrub).toHaveBeenCalledTimes(1);
  });
});

describe('cancelAll corta lo que esté mantenido', () => {
  it('▼ deja de repetir y ▶ no llega a adelantar', () => {
    const actions = mockActions();
    const router = new RemoteControlRouter(actions);
    router.press(KeyCodes.DPAD_DOWN);
    router.press(KeyCodes.DPAD_RIGHT);
    router.cancelAll();
    jest.advanceTimersByTime(3000);
    expect(actions.moveCursor).toHaveBeenCalledTimes(1);
    expect(actions.startScrub).not.toHaveBeenCalled();
  });
});

describe('el resto de los botones', () => {
  it('play/pausa y canal siguen igual', () => {
    const actions = mockActions();
    const router = new RemoteControlRouter(actions);
    tap(router, KeyCodes.MEDIA_PLAY_PAUSE);
    tap(router, KeyCodes.CHANNEL_UP);
    tap(router, KeyCodes.CHANNEL_DOWN);
    expect(actions.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(actions.playFolderOffset.mock.calls).toEqual([[1], [-1]]);
  });

  it.each([
    ['MENU', 82],
    ['DEL', 67],
    ['SEARCH (micrófono)', 84],
  ])('%s no hace nada', (_name, keyCode) => {
    const actions = mockActions();
    tap(new RemoteControlRouter(actions), keyCode);
    jest.advanceTimersByTime(3000);
    expectNothing(actions);
  });
});
