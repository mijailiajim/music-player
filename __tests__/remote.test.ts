/**
 * Router del control remoto: a qué clase va cada botón y qué le pide a la app.
 */
import {RemoteActions} from '../src/core/remote/RemoteActions';
import {RemoteControlRouter} from '../src/core/remote/RemoteControlRouter';
import {
  OkButtonCommand,
  PageDownCommand,
  PageUpCommand,
  PlayAdjacentTrackCommand,
} from '../src/core/remote/commands';
import {KeyCodes} from '../src/keymap';

function mockActions(): jest.Mocked<RemoteActions> {
  return {
    moveCursor: jest.fn(),
    playAdjacent: jest.fn(),
    playSelection: jest.fn(),
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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('botón OK: reproduce la canción seleccionada', () => {
  it.each([
    ['DPAD_CENTER', KeyCodes.DPAD_CENTER],
    ['ENTER', KeyCodes.ENTER],
    ['NUMPAD_ENTER', KeyCodes.NUMPAD_ENTER],
    ['SPACE', KeyCodes.SPACE],
    ['BUTTON_SELECT', KeyCodes.BUTTON_SELECT],
    ['BUTTON_A', KeyCodes.BUTTON_A],
  ])('%s → OkButtonCommand → playSelection', (_name, keyCode) => {
    const spy = jest.spyOn(OkButtonCommand.prototype, 'execute');
    const actions = mockActions();
    new RemoteControlRouter(actions).handle(keyCode);
    expect(spy).toHaveBeenCalledTimes(1);
    expectOnly(actions, 'playSelection');
  });
});

describe('Re Pág / Av Pág: navegan las carpetas', () => {
  it('PAGE_UP → PageUpCommand → sube un nivel', () => {
    const spy = jest.spyOn(PageUpCommand.prototype, 'execute');
    const actions = mockActions();
    new RemoteControlRouter(actions).handle(KeyCodes.PAGE_UP);
    expect(spy).toHaveBeenCalledTimes(1);
    expectOnly(actions, 'goUp');
  });

  it('PAGE_DOWN → PageDownCommand → entra a la carpeta', () => {
    const spy = jest.spyOn(PageDownCommand.prototype, 'execute');
    const actions = mockActions();
    new RemoteControlRouter(actions).handle(KeyCodes.PAGE_DOWN);
    expect(spy).toHaveBeenCalledTimes(1);
    expectOnly(actions, 'enterFolder');
  });
});

describe('flechas', () => {
  it.each([
    ['DPAD_LEFT', KeyCodes.DPAD_LEFT, -1],
    ['DPAD_RIGHT', KeyCodes.DPAD_RIGHT, 1],
  ])(
    '%s → PlayAdjacentTrackCommand → canción vecina (%i)',
    (_name, keyCode, delta) => {
      const spy = jest.spyOn(PlayAdjacentTrackCommand.prototype, 'execute');
      const actions = mockActions();
      new RemoteControlRouter(actions).handle(keyCode);
      expect(spy).toHaveBeenCalledTimes(1);
      expectOnly(actions, 'playAdjacent', delta);
    },
  );

  it.each([
    ['DPAD_UP', KeyCodes.DPAD_UP, -1],
    ['DPAD_DOWN', KeyCodes.DPAD_DOWN, 1],
  ])('%s → mueve el cursor (%i)', (_name, keyCode, delta) => {
    const actions = mockActions();
    new RemoteControlRouter(actions).handle(keyCode);
    expectOnly(actions, 'moveCursor', delta);
  });
});

describe('el resto de los botones sigue igual', () => {
  it('play/pausa y canal', () => {
    const actions = mockActions();
    const router = new RemoteControlRouter(actions);
    router.handle(KeyCodes.MEDIA_PLAY_PAUSE);
    router.handle(KeyCodes.CHANNEL_UP);
    router.handle(KeyCodes.CHANNEL_DOWN);
    expect(actions.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(actions.playFolderOffset.mock.calls).toEqual([[1], [-1]]);
  });

  it('MENÚ (82) no hace nada', () => {
    const actions = mockActions();
    new RemoteControlRouter(actions).handle(82);
    Object.values(actions).forEach(action =>
      expect(action).not.toHaveBeenCalled(),
    );
  });
});
