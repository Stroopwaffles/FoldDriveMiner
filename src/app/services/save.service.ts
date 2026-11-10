import { Injectable } from '@angular/core';
import { CONFIG } from '../game/config';
import { deserialize, serialize } from '../game/save';
import { GameState } from '../game/types';
import { readStorage, removeStorage, writeStorage } from './storage';

const MAIN_KEY = 'fdm.save';
const backupKey = (i: number) => `fdm.save.backup.${i}`;

/** One save per browser, with rolling backups. */
@Injectable({ providedIn: 'root' })
export class SaveService {
  private saveCount = 0;

  hasSave(): boolean {
    return readStorage(MAIN_KEY) !== null || this.findBackup() !== null;
  }

  save(state: GameState): boolean {
    this.saveCount++;
    if (this.saveCount % CONFIG.save.backupEvery === 1) this.rotateBackups();
    return writeStorage(MAIN_KEY, serialize(state));
  }

  /** Loads the main save, falling back to the newest readable backup. */
  load(): GameState | null {
    const main = readStorage(MAIN_KEY);
    if (main) {
      try {
        return deserialize(main);
      } catch (e) {
        console.warn('Main save unreadable, trying backups.', e);
      }
    }
    return this.findBackup();
  }

  clear(): void {
    removeStorage(MAIN_KEY);
    for (let i = 0; i < CONFIG.save.backupCount; i++) removeStorage(backupKey(i));
  }

  private rotateBackups(): void {
    const main = readStorage(MAIN_KEY);
    if (!main) return;
    for (let i = CONFIG.save.backupCount - 1; i > 0; i--) {
      const prev = readStorage(backupKey(i - 1));
      if (prev) writeStorage(backupKey(i), prev);
    }
    writeStorage(backupKey(0), main);
  }

  private findBackup(): GameState | null {
    for (let i = 0; i < CONFIG.save.backupCount; i++) {
      const raw = readStorage(backupKey(i));
      if (!raw) continue;
      try {
        return deserialize(raw);
      } catch {
        /* try the next one */
      }
    }
    return null;
  }
}
