import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type DailyTotals = Record<string, number>; // e.g. { cam_0: 5, cam_1: 3 }
export type EggDatabase = Record<string, DailyTotals>; // keyed by date string

const DB_FILE = path.resolve(process.cwd(), 'egg_data.json');
const CAM_IDS = [0, 1, 2];
const SAVE_INTERVAL_MS = 3000;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  /** In-memory database — all reads/writes go here first */
  private ramDb: EggDatabase = {};

  private saveTimer: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.ramDb = this.loadFromDisk();
    this.startBackgroundSaver();
    this.logger.log('RAM database initialized. Background disk saver started.');
  }

  onModuleDestroy() {
    if (this.saveTimer) clearInterval(this.saveTimer);
    this.saveToDisk(); // final flush on shutdown
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /** Returns a deep copy of the full database (safe to send over HTTP) */
  getAll(): EggDatabase {
    return JSON.parse(JSON.stringify(this.ramDb));
  }

  /** Returns today's totals (all cameras) */
  getTodayTotals(): DailyTotals {
    const today = this.today();
    this.ensureToday(today);
    return { ...this.ramDb[today] };
  }

  /**
   * Increments a camera's count for today.
   * Returns the updated daily totals so callers can broadcast immediately.
   */
  increment(camId: number, count: number): DailyTotals {
    const today = this.today();
    this.ensureToday(today);
    const key = `cam_${camId}`;
    this.ramDb[today][key] = (this.ramDb[today][key] ?? 0) + count;
    return { ...this.ramDb[today] };
  }

  /**
   * Resets a camera's count for today to 0.
   * Also flushes to disk immediately (safety write on manual reset).
   */
  reset(camId: number): DailyTotals {
    const today = this.today();
    this.ensureToday(today);
    this.ramDb[today][`cam_${camId}`] = 0;
    this.saveToDisk(); // immediate flush
    return { ...this.ramDb[today] };
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  private today(): string {
    return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  }

  private ensureToday(today: string) {
    if (!this.ramDb[today]) {
      this.ramDb[today] = Object.fromEntries(CAM_IDS.map((i) => [`cam_${i}`, 0]));
    }
  }

  private loadFromDisk(): EggDatabase {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      this.logger.warn(`Could not load DB from disk: ${e}`);
    }
    return {};
  }

  private saveToDisk() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.ramDb, null, 4), 'utf-8');
    } catch (e) {
      this.logger.error(`Background save error: ${e}`);
    }
  }

  private startBackgroundSaver() {
    // Silently saves RAM → disk every 3 seconds, so camera threads never block on I/O
    this.saveTimer = setInterval(() => this.saveToDisk(), SAVE_INTERVAL_MS);
  }
}