/**
 * Mantener ◀ / ▶: pausar, mover la posición 20 s por segundo y, al soltar,
 * seguir la reproducción desde el segundo al que se llegó.
 */
import {
  PlaybackScrubber,
  ScrubbablePlayer,
} from '../src/core/playback/PlaybackScrubber';

function fakePlayer(
  position: number,
  duration: number,
): jest.Mocked<ScrubbablePlayer> {
  return {
    pause: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    getProgress: jest.fn().mockResolvedValue({position, duration}),
  };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('pausa y adelanta 20 s por segundo; al soltar salta ahí y sigue sonando', async () => {
  const player = fakePlayer(30, 200);
  const scrubber = new PlaybackScrubber(player);

  await scrubber.start(1);
  expect(player.pause).toHaveBeenCalledTimes(1);
  expect(scrubber.getSnapshot()).toEqual({
    position: 30,
    direction: 1,
    holding: true,
  });

  jest.advanceTimersByTime(1000);
  expect(scrubber.getSnapshot()?.position).toBe(50);
  jest.advanceTimersByTime(500);
  expect(scrubber.getSnapshot()?.position).toBe(60);
  // Mientras se mantiene no se toca el reproductor: un solo salto al soltar.
  expect(player.seekTo).not.toHaveBeenCalled();

  await scrubber.finish();
  expect(player.seekTo).toHaveBeenCalledTimes(1);
  expect(player.seekTo).toHaveBeenCalledWith(60);
  expect(player.play).toHaveBeenCalledTimes(1);
  // Se sigue mostrando la posición hasta que la pantalla la lee del reproductor.
  expect(scrubber.getSnapshot()).toEqual({
    position: 60,
    direction: 1,
    holding: false,
  });
  jest.advanceTimersByTime(700);
  expect(scrubber.getSnapshot()).toBeNull();
});

it('atrasa y no baja del principio', async () => {
  const player = fakePlayer(30, 200);
  const scrubber = new PlaybackScrubber(player);
  await scrubber.start(-1);
  jest.advanceTimersByTime(1000);
  expect(scrubber.getSnapshot()?.position).toBe(10);
  jest.advanceTimersByTime(5000);
  expect(scrubber.getSnapshot()?.position).toBe(0);
  await scrubber.finish();
  expect(player.seekTo).toHaveBeenCalledWith(0);
});

it('no pasa del último segundo (no salta al tema siguiente)', async () => {
  const player = fakePlayer(190, 200);
  const scrubber = new PlaybackScrubber(player);
  await scrubber.start(1);
  jest.advanceTimersByTime(3000);
  expect(scrubber.getSnapshot()?.position).toBe(199);
});

it('sin canción cargada no hace nada', async () => {
  const player = fakePlayer(0, 0);
  const scrubber = new PlaybackScrubber(player);
  await scrubber.start(1);
  jest.advanceTimersByTime(1000);
  await scrubber.finish();
  expect(player.pause).not.toHaveBeenCalled();
  expect(player.seekTo).not.toHaveBeenCalled();
  expect(player.play).not.toHaveBeenCalled();
  expect(scrubber.getSnapshot()).toBeNull();
});

it('si se suelta mientras todavía arranca, espera y termina bien', async () => {
  const player = fakePlayer(30, 200);
  const scrubber = new PlaybackScrubber(player);
  const started = scrubber.start(1);
  const finished = scrubber.finish();
  await Promise.all([started, finished]);
  expect(player.seekTo).toHaveBeenCalledWith(30);
  expect(player.play).toHaveBeenCalledTimes(1);
});

it('avisa a quien lo escucha (la pantalla)', async () => {
  const scrubber = new PlaybackScrubber(fakePlayer(30, 200));
  const listener = jest.fn();
  const unsubscribe = scrubber.subscribe(listener);
  await scrubber.start(1);
  jest.advanceTimersByTime(250);
  expect(listener).toHaveBeenCalledTimes(2); // arranca + un paso
  unsubscribe();
  jest.advanceTimersByTime(250);
  expect(listener).toHaveBeenCalledTimes(2);
});

it('cancel corta sin tocar la reproducción', async () => {
  const player = fakePlayer(30, 200);
  const scrubber = new PlaybackScrubber(player);
  await scrubber.start(1);
  scrubber.cancel();
  jest.advanceTimersByTime(1000);
  expect(scrubber.getSnapshot()).toBeNull();
  await scrubber.finish();
  expect(player.seekTo).not.toHaveBeenCalled();
  expect(player.play).not.toHaveBeenCalled();
});
