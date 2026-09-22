const SETTINGS = {
  1: { skill: 0, depth: 2 },
  2: { skill: 4, depth: 5 },
  3: { skill: 8, depth: 8 },
  4: { skill: 14, depth: 12 },
  5: { skill: 20, depth: 18 },
} as const;

export type EngineMove = { from: string; to: string; promotion?: string; uci: string };

type PendingSearch = {
  resolve: (move: EngineMove) => void;
  reject: (error: Error) => void;
  timeout: number;
};

class StockfishBrowserEngine {
  private worker?: Worker;
  private ready?: Promise<void>;
  private resolveReady?: () => void;
  private rejectReady?: (error: Error) => void;
  private pending?: PendingSearch;
  private queue: Promise<void> = Promise.resolve();

  private initialize() {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
      this.worker = new Worker("/stockfish/stockfish.js");
      this.worker.onmessage = (event: MessageEvent<string>) => this.onMessage(String(event.data));
      this.worker.onerror = () => this.fail(new Error("The Stockfish engine could not be loaded."));
      this.worker.postMessage("uci");
    });
    return this.ready;
  }

  private onMessage(line: string) {
    if (line === "uciok") {
      this.worker?.postMessage("isready");
      return;
    }
    if (line === "readyok") {
      this.resolveReady?.();
      this.resolveReady = undefined;
      this.rejectReady = undefined;
      return;
    }
    if (!line.startsWith("bestmove ") || !this.pending) return;
    const pending = this.pending;
    this.pending = undefined;
    window.clearTimeout(pending.timeout);
    const uci = line.split(" ")[1];
    if (!uci || uci === "(none)" || uci.length < 4) {
      pending.reject(new Error("Stockfish did not return a legal move."));
      return;
    }
    pending.resolve({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4], uci });
  }

  private fail(error: Error) {
    this.rejectReady?.(error);
    this.pending?.reject(error);
    if (this.pending) window.clearTimeout(this.pending.timeout);
    this.pending = undefined;
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = undefined;
  }

  request(fen: string, difficulty: number): Promise<EngineMove> {
    return new Promise((resolve, reject) => {
      this.queue = this.queue.catch(() => undefined).then(async () => {
        try {
          await this.initialize();
          const level = Math.min(5, Math.max(1, Math.round(difficulty))) as keyof typeof SETTINGS;
          const { skill, depth } = SETTINGS[level];
          await new Promise<void>((finish) => {
            const timeout = window.setTimeout(() => {
              this.fail(new Error("Stockfish took too long to respond."));
              finish();
            }, 25_000);
            this.pending = {
              resolve: (move) => { resolve(move); finish(); },
              reject: (error) => { reject(error); finish(); },
              timeout,
            };
            this.worker?.postMessage(`setoption name Skill Level value ${skill}`);
            this.worker?.postMessage("ucinewgame");
            this.worker?.postMessage(`position fen ${fen}`);
            this.worker?.postMessage(`go depth ${depth}`);
          });
        } catch (caught) {
          reject(caught instanceof Error ? caught : new Error("Stockfish could not start."));
        }
      });
    });
  }
}

const stockfish = new StockfishBrowserEngine();

export function requestStockfishMove(fen: string, difficulty: number) {
  return stockfish.request(fen, difficulty);
}
