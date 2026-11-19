export interface QueueOptions {
  maxConcurrent?: number;
  queueTimeoutMs?: number;
}

interface QueuedTask {
  resolve: (release: () => void) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class ExecutionQueue {
  private maxConcurrent: number;
  private queueTimeoutMs: number;
  private activeCount: number = 0;
  private queue: QueuedTask[] = [];

  constructor(options: QueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent || 3;
    this.queueTimeoutMs = options.queueTimeoutMs || 10000;
  }

  public async acquire(): Promise<() => void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise<() => void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.queue.findIndex((item) => item.timer === timer);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(
            new Error(
              `Execution queue timeout: waited >${this.queueTimeoutMs}ms for execution slot`
            )
          );
        }
      }, this.queueTimeoutMs);

      this.queue.push({
        resolve: (releaseFn) => {
          clearTimeout(timer);
          resolve(releaseFn);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
      });
    });
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      let released = false;
      const releaseFn = () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
      next.resolve(releaseFn);
    } else {
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
  }

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  public getStatus(): { active: number; queued: number; maxConcurrent: number } {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

export const defaultExecutionQueue = new ExecutionQueue({
  maxConcurrent: Number(process.env.MAX_CONCURRENT_RUNS) || 3,
  queueTimeoutMs: Number(process.env.QUEUE_TIMEOUT_MS) || 10000,
});
