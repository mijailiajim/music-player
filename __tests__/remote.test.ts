/**
 * Router del control remoto: a qué clase va cada botón. El OK y Re Pág/Av Pág
 * están anulados: van a su propia clase, cuya función está vacía.
 */
import {RemoteActions} from '../src/core/remote/RemoteActions';
import {RemoteControlRouter} from '../src/core/remote/RemoteControlRouter';
import {
  OkButtonCommand,
  PageDownCommand,
  PageUpCommand,
} from '../src/core/remote/commands';
import {KeyCodes} from '../src/keymap';

function mockActions(): jest.Mocked<RemoteActions> {
  return {
    moveCursor: jest.fn(),
    moveFolder: jest.fn(),
    playFolderOffset: jest.fn(),
    togglePlayPause: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    nextTrack: jest.fn(),
    previousTrack: jest.fn(),
    seekBy: jest.fn(),
  };
}

function expectNothingDone(actions: jest.Mocked<RemoteActions>) {
  Object.values(actions).forEach(action =>
    expect(action).not.toHaveBeenCalled(),
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('botones anulados: van a su clase y no hacen nada', () => {
  it.each([
    ['DPAD_CENTER', KeyCodes.DPAD_CENTER],
    ['ENTER', KeyCodes.ENTER],
    ['NUMPAD_ENTER', KeyCodes.NUMPAD_ENTER],
    ['SPACE', KeyCodes.SPACE],
    ['BUTTON_SELECT', KeyCodes.BUTTON_SELECT],
    ['BUTTON_A', KeyCodes.BUTTON_A],
  ])('OK (%s) → OkButtonCommand', (_name, keyCode) => {
    const spy = jest.spyOn(OkButtonCommand.prototype, 'execute');
    const actions = mockActions();
    new RemoteControlRouter(actions).handle(keyCode);
    expect(spy).toHaveBeenCalledTimes(1);
    expectNothingDone(actions);
  });

  it('Page ▲ (PAGE_UP) → PageUpCommand', () => {
    const spy = jest.spyOn(PageUpCommand.prototype, 'execute');
    const actions = mockActions();
    new RemoteControlRouter(actions).handle(KeyCodes.PAGE_UP);
    expect(spy).toHaveBeenCalledTimes(1);
    expectNothingDone(actions);
  });

  it('Page ▼ (PAGE_DOWN) → PageDownCommand', () => {
    const spy = jest.spyOn(PageDownCommand.prototype, 'execute');
    const actions = mockActions();
    new RemoteControlRouter(actions).handle(KeyCodes.PAGE_DOWN);
    expect(spy).toHaveBeenCalledTimes(1);
    expectNothingDone(actions);
  });
});

describe('el resto de los botones sigue igual', () => {
  it('flechas, play/pausa y canal', () => {
    const actions = mockActions();
    const router = new RemoteControlRouter(actions);
    router.handle(KeyCodes.DPAD_DOWN);
    router.handle(KeyCodes.DPAD_RIGHT);
    router.handle(KeyCodes.MEDIA_PLAY_PAUSE);
    router.handle(KeyCodes.CHANNEL_UP);
    router.handle(KeyCodes.CHANNEL_DOWN);
    expect(actions.moveCursor).toHaveBeenCalledWith(1);
    expect(actions.moveFolder).toHaveBeenCalledWith(1);
    expect(actions.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(actions.playFolderOffset.mock.calls).toEqual([[1], [-1]]);
  });
});
