import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execAsync = promisify(exec);

export interface DeckSyncResult {
  created: number;
  updated: number;
  skippedDecks: number;
  skippedCards: number;
  durationMs: number;
}

@Injectable()
export class DeckSyncService {
  private readonly logger = new Logger(DeckSyncService.name);
  private isSyncing = false;

  /** Runs at 06:00 and 18:00 UTC every day. */
  @Cron('0 6,18 * * *')
  async syncCron(): Promise<void> {
    this.logger.log('Cron: starting scheduled riftdecks.com deck sync');
    await this.syncNow();
  }

  async syncNow(): Promise<DeckSyncResult> {
    if (this.isSyncing) {
      this.logger.warn('Deck sync already in progress, skipping');
      return { created: 0, updated: 0, skippedDecks: 0, skippedCards: 0, durationMs: 0 };
    }

    this.isSyncing = true;
    const startMs = Date.now();

    try {
      const databaseUrl = process.env['DATABASE_URL'];
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // Resolve the sync script path relative to the monorepo root.
      // __dirname in the compiled API is apps/api/dist/modules/deck-sync/
      // The sync script lives at tools/seed/src/sync-riftdecks.ts
      const monoRepoRoot = path.resolve(__dirname, '../../../../..');
      const scriptPath = path.join(monoRepoRoot, 'tools', 'seed', 'src', 'sync-riftdecks.ts');

      this.logger.log(`Running sync script: ${scriptPath}`);

      const { stdout, stderr } = await execAsync(
        `npx tsx "${scriptPath}"`,
        {
          env: { ...process.env, DATABASE_URL: databaseUrl },
          timeout: 10 * 60 * 1000, // 10 minute safety cap
        },
      );

      if (stdout) this.logger.log(stdout.trim());
      if (stderr) this.logger.warn(stderr.trim());

      // Parse summary line: "Sync complete. Created: N, Updated: N, Skipped decks: N, Skipped cards: N"
      const summaryMatch = stdout.match(
        /Created:\s*(\d+),\s*Updated:\s*(\d+),\s*Skipped decks:\s*(\d+),\s*Skipped cards:\s*(\d+)/,
      );

      const result: DeckSyncResult = {
        created: summaryMatch ? parseInt(summaryMatch[1] ?? '0', 10) : 0,
        updated: summaryMatch ? parseInt(summaryMatch[2] ?? '0', 10) : 0,
        skippedDecks: summaryMatch ? parseInt(summaryMatch[3] ?? '0', 10) : 0,
        skippedCards: summaryMatch ? parseInt(summaryMatch[4] ?? '0', 10) : 0,
        durationMs: Date.now() - startMs,
      };

      this.logger.log(
        `Deck sync complete in ${result.durationMs}ms — created: ${result.created}, updated: ${result.updated}, skipped decks: ${result.skippedDecks}, skipped cards: ${result.skippedCards}`,
      );

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Deck sync failed: ${message}`);
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }

  getSyncStatus(): { isSyncing: boolean } {
    return { isSyncing: this.isSyncing };
  }
}
