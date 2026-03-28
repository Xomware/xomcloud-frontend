// download-queue.service.ts - Manages the download staging area ("My Crate")
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Track } from '../models';
import { ToastService } from './toast.service';

export interface QueuedTrack {
  track: Track;
  addedAt: Date;
}

interface StoredQueueItem {
  track: Track;
  addedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class DownloadQueueService {
  private readonly STORAGE_KEY = 'xomcloud_download_queue';
  private queue$ = new BehaviorSubject<QueuedTrack[]>([]);
  private isProcessing$ = new BehaviorSubject<boolean>(false);

  constructor(private toastService: ToastService) {
    this.loadFromStorage();
  }

  // ==================== Queue Management ====================

  getQueue$(): Observable<QueuedTrack[]> {
    return this.queue$.asObservable();
  }

  getQueue(): QueuedTrack[] {
    return this.queue$.value;
  }

  getQueueCount(): number {
    return this.queue$.value.length;
  }

  getQueueCount$(): Observable<number> {
    return this.queue$.pipe(map(queue => queue.length));
  }

  isInQueue(trackId: number): boolean {
    return this.queue$.value.some((item) => item.track.id === trackId);
  }

  // ==================== Add/Remove Operations ====================

  addToQueue(track: Track): boolean {
    if (this.isInQueue(track.id)) {
      this.toastService.showInfoToast('Track already in your crate');
      return false;
    }

    const queuedTrack: QueuedTrack = {
      track,
      addedAt: new Date(),
    };

    const currentQueue = this.queue$.value;
    this.queue$.next([...currentQueue, queuedTrack]);
    this.saveToStorage();

    this.toastService.showPositiveToast(`Added "${track.title}" to your crate`);
    return true;
  }

  addMultipleToQueue(tracks: Track[]): number {
    let addedCount = 0;
    const currentQueue = [...this.queue$.value];

    tracks.forEach((track) => {
      if (!this.isInQueue(track.id)) {
        currentQueue.push({
          track,
          addedAt: new Date(),
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      this.queue$.next(currentQueue);
      this.saveToStorage();
      this.toastService.showPositiveToast(
        `Added ${addedCount} tracks to your crate`
      );
    }

    return addedCount;
  }

  removeFromQueue(trackId: number): void {
    const currentQueue = this.queue$.value;
    const track = currentQueue.find((item) => item.track.id === trackId);

    this.queue$.next(currentQueue.filter((item) => item.track.id !== trackId));
    this.saveToStorage();

    if (track) {
      this.toastService.showInfoToast(
        `Removed "${track.track.title}" from crate`
      );
    }
  }

  clearQueue(): void {
    this.queue$.next([]);
    this.saveToStorage();
    this.toastService.showInfoToast('Crate cleared');
  }

  clearQueueSilent(): void {
    this.queue$.next([]);
    this.saveToStorage();
  }

  // ==================== Reordering ====================

  moveInQueue(fromIndex: number, toIndex: number): void {
    const queue = [...this.queue$.value];
    const [removed] = queue.splice(fromIndex, 1);
    queue.splice(toIndex, 0, removed);
    this.queue$.next(queue);
    this.saveToStorage();
  }

  // ==================== Processing State ====================

  isProcessing(): boolean {
    return this.isProcessing$.value;
  }

  getIsProcessing$(): Observable<boolean> {
    return this.isProcessing$.asObservable();
  }

  setProcessing(value: boolean): void {
    this.isProcessing$.next(value);
  }

  // ==================== Storage ====================

  private saveToStorage(): void {
    try {
      const data = this.queue$.value.map((item) => ({
        track: item.track,
        addedAt: item.addedAt.toISOString(),
      }));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage quota exceeded or unavailable - silently fail
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data: StoredQueueItem[] = JSON.parse(stored);
        const queue: QueuedTrack[] = data.map((item) => ({
          track: item.track,
          addedAt: new Date(item.addedAt),
        }));
        this.queue$.next(queue);
      }
    } catch {
      // Corrupt storage data - silently fail
    }
  }

  // ==================== Utilities ====================

  getTotalDuration(): number {
    return this.queue$.value.reduce(
      (total, item) => total + item.track.duration,
      0
    );
  }

  formatTotalDuration(): string {
    const totalMs = this.getTotalDuration();
    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  }
}
