/**
 * TypeScript Orchestrator for Remote Embedding Agent
 * 
 * This provides a TS interface for coordinating with the Python embedding agent,
 * enabling integration with Node.js/Next.js applications.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';

export interface OrchestratorConfig {
  pythonPath?: string;
  agentPath: string;
  weaviateUrl: string;
  embeddingModel?: string;
  watchPaths: string[];
}

export interface ProcessingResult {
  totalFiles: number;
  processed: number;
  skipped: number;
  errors: number;
  totalChunks: number;
}

export interface SearchResult {
  filePath: string;
  fileName: string;
  chunkText: string;
  chunkIndex: number;
  distance: number;
}

export class EmbeddingOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private process: ChildProcess | null = null;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = {
      pythonPath: 'python3',
      embeddingModel: 'bge-small',
      ...config,
    };
  }

  /**
   * Start the Python embedding agent in watch mode
   */
  async startWatcher(): Promise<void> {
    const args = [
      '-m', 'embedding_agent.cli',
      'watch',
      '--model', this.config.embeddingModel!,
      '--weaviate-url', this.config.weaviateUrl,
      ...this.config.watchPaths.flatMap(p => ['--path', p]),
    ];

    this.process = spawn(this.config.pythonPath!, args, {
      cwd: path.join(this.config.agentPath, 'src'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    this.process.stdout?.on('data', (data) => {
      const output = data.toString();
      this.emit('output', output);
      this.parseOutput(output);
    });

    this.process.stderr?.on('data', (data) => {
      this.emit('error', data.toString());
    });

    this.process.on('close', (code) => {
      this.emit('close', code);
      this.process = null;
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Agent startup timeout'));
      }, 30000);

      this.once('initialized', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Stop the embedding agent
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        this.once('close', resolve);
        setTimeout(resolve, 5000);
      });
    }
  }

  /**
   * Run a one-time sync
   */
  async sync(paths: string[]): Promise<ProcessingResult> {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', 'embedding_agent.cli',
        'sync',
        '--model', this.config.embeddingModel!,
        '--weaviate-url', this.config.weaviateUrl,
        ...paths,
      ];

      const proc = spawn(this.config.pythonPath!, args, {
        cwd: path.join(this.config.agentPath, 'src'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });

      let output = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        this.emit('error', data.toString());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(this.parseSyncResult(output));
        } else {
          reject(new Error(`Sync failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Search for similar content
   */
  async search(query: string, limit = 5, extension?: string): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', 'embedding_agent.cli',
        'search',
        query,
        '--limit', limit.toString(),
      ];

      if (extension) {
        args.push('--ext', extension);
      }

      const proc = spawn(this.config.pythonPath!, args, {
        cwd: path.join(this.config.agentPath, 'src'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });

      let output = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(this.parseSearchResults(output));
        } else {
          reject(new Error(`Search failed with code ${code}`));
        }
      });
    });
  }

  private parseOutput(output: string): void {
    if (output.includes('Agent initialized')) {
      this.emit('initialized');
    }
    if (output.includes('Updated:') || output.includes('Processed:')) {
      const match = output.match(/(\w+): (.+?) \((\d+) chunks\)/);
      if (match) {
        this.emit('fileProcessed', {
          action: match[1].toLowerCase(),
          file: match[2],
          chunks: parseInt(match[3], 10),
        });
      }
    }
    if (output.includes('Removed:')) {
      const match = output.match(/Removed: (.+)/);
      if (match) {
        this.emit('fileRemoved', { file: match[1] });
      }
    }
  }

  private parseSyncResult(output: string): ProcessingResult {
    // Parse the table output from sync command
    const lines = output.split('\n');
    const result: ProcessingResult = {
      totalFiles: 0,
      processed: 0,
      skipped: 0,
      errors: 0,
      totalChunks: 0,
    };

    for (const line of lines) {
      if (line.includes('Total Files')) {
        const match = line.match(/(\d+)/);
        if (match) result.totalFiles = parseInt(match[1], 10);
      }
      if (line.includes('Processed') && !line.includes('Total')) {
        const match = line.match(/(\d+)/);
        if (match) result.processed = parseInt(match[1], 10);
      }
      if (line.includes('Skipped')) {
        const match = line.match(/(\d+)/);
        if (match) result.skipped = parseInt(match[1], 10);
      }
      if (line.includes('Errors')) {
        const match = line.match(/(\d+)/);
        if (match) result.errors = parseInt(match[1], 10);
      }
      if (line.includes('Total Chunks')) {
        const match = line.match(/(\d+)/);
        if (match) result.totalChunks = parseInt(match[1], 10);
      }
    }

    return result;
  }

  private parseSearchResults(output: string): SearchResult[] {
    // Parse search output
    const results: SearchResult[] = [];
    const blocks = output.split(/\n\d+\./);

    for (const block of blocks.slice(1)) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;

      const fileMatch = lines[0].match(/(.+)/);
      const pathMatch = lines.find(l => l.includes('Path:'))?.match(/Path: (.+)/);
      const chunkMatch = lines.find(l => l.includes('Chunk:'))?.match(/Chunk: (\d+)/);
      const distanceMatch = lines.find(l => l.includes('Distance:'))?.match(/Distance: ([\d.]+)/);

      if (fileMatch && pathMatch) {
        results.push({
          fileName: fileMatch[1].trim(),
          filePath: pathMatch[1].trim(),
          chunkIndex: chunkMatch ? parseInt(chunkMatch[1], 10) - 1 : 0,
          distance: distanceMatch ? parseFloat(distanceMatch[1]) : 0,
          chunkText: lines.slice(4).join('\n').trim(),
        });
      }
    }

    return results;
  }
}

export default EmbeddingOrchestrator;
