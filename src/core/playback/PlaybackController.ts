import {FolderGroup} from '../model';
import {AudioPlayerPort} from './AudioPlayerPort';
import {QueueFactory} from './QueueFactory';

/**
 * Orquesta la reproducción sobre un `AudioPlayerPort` abstracto. Concentra las
 * reglas (inicialización única, cargar cola, reproducir por índice, alternar
 * play/pausa, saltar, seek) sin conocer la librería de audio concreta.
 */
export class PlaybackController {
  private setupPromise: Promise<void> | null = null;

  constructor(
    private readonly player: AudioPlayerPort,
    private readonly queueFactory: QueueFactory,
  ) {}

  setupOnce(): Promise<void> {
    if (!this.setupPromise) {
      this.setupPromise = this.player.setup().catch(error => {
        this.setupPromise = null;
        throw error;
      });
    }
    return this.setupPromise;
  }

  async loadQueue(groups: FolderGroup[], autoplay: boolean): Promise<void> {
    const tracks = this.queueFactory.build(groups);
    await this.player.reset();
    if (tracks.length === 0) {
      return;
    }
    await this.player.add(tracks);
    if (autoplay) {
      await this.player.play();
    }
  }

  async clearQueue(): Promise<void> {
    try {
      await this.player.reset();
    } catch {}
  }

  async playTrackAt(index: number): Promise<void> {
    try {
      await this.player.skipTo(index);
      await this.player.play();
    } catch {}
  }

  resume(): Promise<void> {
    return this.player.play();
  }

  pause(): Promise<void> {
    return this.player.pause();
  }

  seekToPosition(seconds: number): Promise<void> {
    return this.player.seekTo(seconds);
  }

  async togglePlayPause(): Promise<void> {
    try {
      if (await this.player.isActive()) {
        await this.player.pause();
      } else {
        await this.player.play();
      }
    } catch {}
  }

  async skipToNext(): Promise<void> {
    try {
      await this.player.skipToNext();
      await this.player.play();
    } catch {}
  }

  async skipToPrevious(): Promise<void> {
    try {
      await this.player.skipToPrevious();
      await this.player.play();
    } catch {}
  }

  async seekBy(offsetSeconds: number): Promise<void> {
    try {
      const {position, duration} = await this.player.getProgress();
      const target = Math.max(0, position + offsetSeconds);
      await this.player.seekTo(
        duration > 0 ? Math.min(target, duration) : target,
      );
    } catch {}
  }
}
