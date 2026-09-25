/**
 * Keep awake de la reproducción: mientras suena música el equipo no se duerme
 * (aunque se apague la pantalla); en pausa, detenida o con error se suelta.
 */
jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {addEventListener: jest.fn()},
  Event: {PlaybackState: 'playback-state'},
  State: {
    None: 'none',
    Ready: 'ready',
    Playing: 'playing',
    Paused: 'paused',
    Stopped: 'stopped',
    Loading: 'loading',
    Buffering: 'buffering',
    Error: 'error',
    Ended: 'ended',
  },
}));

import {State} from 'react-native-track-player';
import {
  KeepAwakePort,
  PlaybackKeepAwake,
} from '../src/core/playback/PlaybackKeepAwake';

function setup() {
  const port: jest.Mocked<KeepAwakePort> = {setPlaybackAwake: jest.fn()};
  return {port, keepAwake: new PlaybackKeepAwake(port)};
}

it.each([State.Playing, State.Buffering, State.Loading])(
  'con el reproductor en "%s" mantiene despierto el equipo',
  state => {
    const {port, keepAwake} = setup();
    keepAwake.update(state);
    expect(port.setPlaybackAwake.mock.calls).toEqual([[true]]);
  },
);

it.each([
  State.Paused,
  State.Stopped,
  State.Ended,
  State.Error,
  State.None,
  State.Ready,
])('en "%s" lo suelta (no gasta batería de más)', state => {
  const {port, keepAwake} = setup();
  keepAwake.update(State.Playing);
  keepAwake.update(state);
  expect(port.setPlaybackAwake.mock.calls).toEqual([[true], [false]]);
});

it('al arrancar no pide nada hasta que empieza a sonar', () => {
  const {port, keepAwake} = setup();
  keepAwake.update(undefined);
  keepAwake.update(State.None);
  keepAwake.update(State.Paused);
  expect(port.setPlaybackAwake).not.toHaveBeenCalled();
});

it('solo avisa cuando cambia: entre canciones sigue despierto sin soltar', () => {
  const {port, keepAwake} = setup();
  [
    State.Playing,
    State.Loading, // siguiente canción
    State.Buffering,
    State.Playing,
    State.Paused,
    State.Stopped,
    State.Playing,
  ].forEach(state => keepAwake.update(state));
  expect(port.setPlaybackAwake.mock.calls).toEqual([[true], [false], [true]]);
});
