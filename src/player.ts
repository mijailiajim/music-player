import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  RepeatMode,
  State,
  Track,
} from 'react-native-track-player';
import {flattenGroups, FolderGroup} from './library';

/** Track de la cola con los metadatos de carpeta que agrega esta app. */
export interface QueueTrack extends Track {
  folderIndex: number;
  indexInFolder: number;
}

export const SEEK_STEP_SECONDS = 10;

/**
 * Reporte de errores del reproductor hacia la UI. Los fallos del player no
 * deben ser silenciosos: sin esto, un setupPlayer fallido deja la app muda
 * sin ninguna pista de qué pasó.
 */
type PlayerErrorListener = (message: string) => void;
let errorListener: PlayerErrorListener | null = null;

export function setPlayerErrorListener(listener: PlayerErrorListener | null) {
  errorListener = listener;
}

export function reportPlayerError(context: string, error: unknown) {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error != null && 'message' in error
      ? String((error as {message: unknown}).message)
      : String(error);
  errorListener?.(`${context}: ${detail}`);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let playerReady = false;
let setupInFlight: Promise<boolean> | null = null;

export function isPlayerReady(): boolean {
  return playerReady;
}

/**
 * Inicializa el reproductor con reintentos (al arrancar en frío Android puede
 * responder "app in background" durante un instante). Devuelve true si quedó
 * listo. Importante: los búferes van EXPLÍCITOS porque la capa nativa de
 * react-native-track-player 4.1.2 lee cada clave ausente como 0 cuando se
 * pasa cualquier objeto de opciones, y con búfer 0 ExoPlayer no reproduce.
 * Valores = defaults de ExoPlayer (en segundos).
 */
export function setupPlayerOnce(): Promise<boolean> {
  if (playerReady) {
    return Promise.resolve(true);
  }
  if (!setupInFlight) {
    setupInFlight = doSetup().finally(() => {
      setupInFlight = null;
    });
  }
  return setupInFlight;
}

async function doSetup(): Promise<boolean> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await TrackPlayer.setupPlayer({
        minBuffer: 50,
        maxBuffer: 50,
        playBuffer: 2.5,
        backBuffer: 0,
        autoHandleInterruptions: true,
      });
      playerReady = true;
      break;
    } catch (error) {
      const text =
        error instanceof Error ? error.message : String(error ?? 'desconocido');
      if (text.includes('already been initialized')) {
        playerReady = true;
        break;
      }
      if (attempt === maxAttempts) {
        reportPlayerError('No pude iniciar el reproductor', error);
        return false;
      }
      await delay(1200);
    }
  }
  try {
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.JumpForward,
        Capability.JumpBackward,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      forwardJumpInterval: SEEK_STEP_SECONDS,
      backwardJumpInterval: SEEK_STEP_SECONDS,
      progressUpdateEventInterval: 1,
    });
    // Al terminar el último tema del pendrive vuelve a empezar por el primero.
    await TrackPlayer.setRepeatMode(RepeatMode.Queue);
  } catch (error) {
    reportPlayerError('Configuración del reproductor', error);
  }
  return true;
}

export async function loadQueue(
  groups: FolderGroup[],
  autoplay: boolean,
): Promise<void> {
  const ready = await setupPlayerOnce();
  if (!ready) {
    throw new Error('el reproductor no se pudo inicializar');
  }
  const tracks: QueueTrack[] = flattenGroups(groups).map(t => ({
    id: t.path,
    url: t.url,
    title: t.title,
    artist: t.folderName,
    album: t.folderName,
    folderIndex: t.folderIndex,
    indexInFolder: t.indexInFolder,
  }));
  await TrackPlayer.reset();
  if (tracks.length === 0) {
    return;
  }
  await TrackPlayer.add(tracks);
  if (autoplay) {
    await TrackPlayer.play();
  }
}

export async function clearQueue(): Promise<void> {
  try {
    await TrackPlayer.reset();
  } catch {}
}

export async function playTrackAt(globalIndex: number): Promise<void> {
  try {
    await TrackPlayer.skip(globalIndex);
    await TrackPlayer.play();
  } catch (error) {
    reportPlayerError('Reproducir pista', error);
  }
}

export async function togglePlayPause(): Promise<void> {
  try {
    const {state} = await TrackPlayer.getPlaybackState();
    if (state === State.Playing || state === State.Buffering) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  } catch (error) {
    reportPlayerError('Play/Pausa', error);
  }
}

export async function skipToNext(): Promise<void> {
  try {
    await TrackPlayer.skipToNext();
    await TrackPlayer.play();
  } catch (error) {
    reportPlayerError('Siguiente', error);
  }
}

export async function skipToPrevious(): Promise<void> {
  try {
    await TrackPlayer.skipToPrevious();
    await TrackPlayer.play();
  } catch (error) {
    reportPlayerError('Anterior', error);
  }
}

export async function seekBy(offsetSeconds: number): Promise<void> {
  try {
    const progress = await TrackPlayer.getProgress();
    const target = Math.max(0, progress.position + offsetSeconds);
    await TrackPlayer.seekTo(
      progress.duration > 0 ? Math.min(target, progress.duration) : target,
    );
  } catch (error) {
    reportPlayerError('Adelantar/atrasar', error);
  }
}

export function isPlayingState(state: State | undefined): boolean {
  return (
    state === State.Playing ||
    state === State.Buffering ||
    state === State.Loading
  );
}

export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
