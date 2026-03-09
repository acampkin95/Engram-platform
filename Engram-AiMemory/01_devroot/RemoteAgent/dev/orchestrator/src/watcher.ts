/**
 * File Watcher
 * Watches directories for changes and queues files for processing
 */

import chokidar from 'chokidar';
import PQueue from 'p-queue';
import chalk from 'chalk';
import { AgentClient } from './client.js';

export interface WatcherConfig {
  directories: string[];
  extensions: string[];
  ignored?: string[];
  debounceMs?: number;
  concurrency?: number;
}

export class FileWatcher {
  private client: AgentClient;
  private config: WatcherConfig;
  private watcher: chokidar.FSWatcher | null = null;
  private queue: PQueue;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(client: AgentClient, config: WatcherConfig) {
    this.client = client;
    this.config = {
      debounceMs: 1000,
      concurrency: 3,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      ...config,
    };
    this.queue = new PQueue({ concurrency: this.config.concurrency });
  }

  private shouldProcess(filePath: string): boolean {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    return this.config.extensions.includes(ext);
  }

  private debounce(filePath: string, callback: () => void): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      callback();
    }, this.config.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      console.log(chalk.blue('Processing:'), filePath);
      const result = await this.client.processFile(filePath);

      if (result.success) {
        if (result.chunks_synced > 0) {
          console.log(
            chalk.green('✓'),
            filePath,
            chalk.dim(`(${result.chunks_synced} chunks)`)
          );
        } else {
          console.log(chalk.dim('○'), filePath, chalk.dim('(unchanged)'));
        }
      } else {
        console.log(chalk.yellow('!'), filePath, chalk.red(result.error || 'Failed'));
      }
    } catch (error) {
      console.error(chalk.red('✗'), filePath, error);
    }
  }

  private queueFile(filePath: string): void {
    this.debounce(filePath, () => {
      this.queue.add(() => this.processFile(filePath));
    });
  }

  start(): void {
    console.log(chalk.bold.blue('\n═══ Starting File Watcher ═══\n'));

    const watchGlobs = this.config.directories.flatMap((dir) =>
      this.config.extensions.map((ext) => `${dir}/**/*${ext}`)
    );

    this.watcher = chokidar.watch(watchGlobs, {
      ignored: this.config.ignored,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (path) => {
        if (this.shouldProcess(path)) {
          console.log(chalk.dim('+ Added:'), path);
          this.queueFile(path);
        }
      })
      .on('change', (path) => {
        if (this.shouldProcess(path)) {
          console.log(chalk.dim('~ Changed:'), path);
          this.queueFile(path);
        }
      })
      .on('unlink', async (path) => {
        if (this.shouldProcess(path)) {
          console.log(chalk.dim('- Deleted:'), path);
          try {
            await this.client.deleteFile(path);
            console.log(chalk.yellow('Removed from index:'), path);
          } catch {
            // File might not be in index
          }
        }
      })
      .on('error', (error) => {
        console.error(chalk.red('Watcher error:'), error);
      })
      .on('ready', () => {
        console.log(chalk.green('\n✓ Watcher ready'));
        console.log(chalk.dim('Watching directories:'));
        this.config.directories.forEach((dir) => {
          console.log(chalk.dim('  •'), dir);
        });
        console.log();
      });
  }

  async stop(): Promise<void> {
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Wait for queue to drain
    await this.queue.onIdle();

    // Stop watcher
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    console.log(chalk.yellow('\nWatcher stopped'));
  }

  getQueueSize(): number {
    return this.queue.size + this.queue.pending;
  }
}
