import {KeyCodes} from '../src/keymap';
import {
  createRemoteKeyHandler,
  HOLD_FALLBACK_MS,
  RemoteActions,
} from '../src/remote';

function makeActions() {
  return {
    moveSelection: jest.fn(),
    moveFolder: jest.fn(),
    playSelection: jest.fn(),
    togglePlayPause: jest.fn(),
    nextTrack: jest.fn(),
    previousTrack: jest.fn(),
    seekBy: jest.fn(),
    playFolderOffset: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
  } satisfies RemoteActions;
}

describe('createRemoteKeyHandler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const setup = () => {
    const actions = makeActions();
    const handle = createRemoteKeyHandler(actions, 10);
    return {actions, handle};
  };

  it('OK corto reproduce la selección', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.DPAD_CENTER, repeatCount: 0, action: 'down'});
    jest.advanceTimersByTime(120);
    handle({keyCode: KeyCodes.DPAD_CENTER, repeatCount: 0, action: 'up'});
    expect(actions.playSelection).toHaveBeenCalledTimes(1);
    expect(actions.togglePlayPause).not.toHaveBeenCalled();
  });

  it('OK mantenido (con autorepetición) hace play/pausa una sola vez', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.DPAD_CENTER, repeatCount: 0, action: 'down'});
    jest.advanceTimersByTime(600);
    handle({keyCode: KeyCodes.DPAD_CENTER, repeatCount: 1, action: 'down'});
    handle({keyCode: KeyCodes.DPAD_CENTER, repeatCount: 2, action: 'down'});
    handle({keyCode: KeyCodes.DPAD_CENTER, repeatCount: 0, action: 'up'});
    expect(actions.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(actions.playSelection).not.toHaveBeenCalled();
  });

  it('OK mantenido sin autorepetición decide por duración al soltar', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.DPAD_CENTER, repeatCount: 0, action: 'down'});
    jest.advanceTimersByTime(800);
    handle({keyCode: KeyCodes.DPAD_CENTER, repeatCount: 0, action: 'up'});
    expect(actions.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(actions.playSelection).not.toHaveBeenCalled();
  });

  it('sin key-up dispara la acción larga al vencer el plazo y luego ignora el up tardío', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.DPAD_CENTER, repeatCount: 0, action: 'down'});
    jest.advanceTimersByTime(HOLD_FALLBACK_MS);
    expect(actions.togglePlayPause).toHaveBeenCalledTimes(1);
    handle({keyCode: KeyCodes.DPAD_CENTER, repeatCount: 0, action: 'up'});
    expect(actions.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(actions.playSelection).not.toHaveBeenCalled();
  });

  it('◀/▶ corto cambia de carpeta', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.DPAD_RIGHT, repeatCount: 0, action: 'down'});
    jest.advanceTimersByTime(100);
    handle({keyCode: KeyCodes.DPAD_RIGHT, repeatCount: 0, action: 'up'});
    expect(actions.moveFolder).toHaveBeenCalledWith(1);
    expect(actions.seekBy).not.toHaveBeenCalled();
  });

  it('▶ mantenido adelanta con cadencia limitada y no cambia de carpeta', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.DPAD_RIGHT, repeatCount: 0, action: 'down'});
    jest.advanceTimersByTime(600);
    handle({keyCode: KeyCodes.DPAD_RIGHT, repeatCount: 1, action: 'down'});
    expect(actions.seekBy).toHaveBeenCalledTimes(1);
    expect(actions.seekBy).toHaveBeenLastCalledWith(10);
    jest.advanceTimersByTime(200);
    handle({keyCode: KeyCodes.DPAD_RIGHT, repeatCount: 2, action: 'down'});
    expect(actions.seekBy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(300);
    handle({keyCode: KeyCodes.DPAD_RIGHT, repeatCount: 3, action: 'down'});
    expect(actions.seekBy).toHaveBeenCalledTimes(2);
    handle({keyCode: KeyCodes.DPAD_RIGHT, repeatCount: 0, action: 'up'});
    expect(actions.moveFolder).not.toHaveBeenCalled();
  });

  it('◀ mantenido atrasa', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.DPAD_LEFT, repeatCount: 0, action: 'down'});
    jest.advanceTimersByTime(700);
    handle({keyCode: KeyCodes.DPAD_LEFT, repeatCount: 0, action: 'up'});
    expect(actions.seekBy).toHaveBeenCalledWith(-10);
    expect(actions.moveFolder).not.toHaveBeenCalled();
  });

  it('MENÚ corto = pista siguiente, mantenido = pista anterior', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.MENU, repeatCount: 0, action: 'down'});
    jest.advanceTimersByTime(100);
    handle({keyCode: KeyCodes.MENU, repeatCount: 0, action: 'up'});
    expect(actions.nextTrack).toHaveBeenCalledTimes(1);

    handle({keyCode: KeyCodes.MENU, repeatCount: 0, action: 'down'});
    jest.advanceTimersByTime(700);
    handle({keyCode: KeyCodes.MENU, repeatCount: 0, action: 'up'});
    expect(actions.previousTrack).toHaveBeenCalledTimes(1);
    expect(actions.nextTrack).toHaveBeenCalledTimes(1);
  });

  it('▲/▼ mueven la selección también con autorepetición', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.DPAD_DOWN, repeatCount: 0, action: 'down'});
    handle({keyCode: KeyCodes.DPAD_DOWN, repeatCount: 1, action: 'down'});
    handle({keyCode: KeyCodes.DPAD_DOWN, repeatCount: 2, action: 'down'});
    handle({keyCode: KeyCodes.DPAD_UP, repeatCount: 0, action: 'down'});
    expect(actions.moveSelection).toHaveBeenCalledTimes(4);
    expect(actions.moveSelection).toHaveBeenLastCalledWith(-1);
  });

  it('las teclas multimedia actúan solo en la pulsación inicial', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.MEDIA_NEXT, repeatCount: 0, action: 'down'});
    handle({keyCode: KeyCodes.MEDIA_NEXT, repeatCount: 1, action: 'down'});
    handle({keyCode: KeyCodes.MEDIA_NEXT, repeatCount: 0, action: 'up'});
    expect(actions.nextTrack).toHaveBeenCalledTimes(1);
    handle({keyCode: KeyCodes.CHANNEL_UP, repeatCount: 0, action: 'down'});
    expect(actions.playFolderOffset).toHaveBeenCalledWith(1);
  });

  it('eventos sin campo action se tratan como pulsación', () => {
    const {actions, handle} = setup();
    handle({keyCode: KeyCodes.MEDIA_PLAY_PAUSE, repeatCount: 0});
    expect(actions.togglePlayPause).toHaveBeenCalledTimes(1);
  });
});
