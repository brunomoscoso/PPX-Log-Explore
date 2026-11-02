import type { WorkerCommand, WorkerResponse, WorkerResult } from '../types/worker.types';

/** Mantém os logs no worker; só transfere a página visível ou uma exportação pedida. */
export class LogWorkerClient {
  private worker = new Worker(new URL('../workers/log.worker.ts', import.meta.url), { type: 'module' });
  private sequence = 0;
  private stopped = false;
  private pending = new Map<number, { resolve: (result: WorkerResult) => void; reject: (error: Error) => void }>();

  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      const request = this.pending.get(data.id);
      this.pending.delete(data.id);
      if (data.ok) request?.resolve(data.result);
      else request?.reject(new Error(data.error));
    };
    this.worker.onerror = (event) => {
      event.preventDefault();
      this.stopped = true;
      this.worker.terminate();
      this.failPending(new Error('O processamento foi interrompido. Volte a importar o ficheiro.'));
    };
  }

  request(command: WorkerCommand): Promise<WorkerResult> {
    if (this.stopped) return Promise.reject(new Error('O processamento foi interrompido. Volte a importar o ficheiro.'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage({ ...command, id });
      } catch {
        this.pending.delete(id);
        reject(new Error('Não foi possível iniciar o processamento. Volte a importar o ficheiro.'));
      }
    });
  }

  dispose(): void {
    this.stopped = true;
    this.worker.terminate();
    this.failPending(new Error('Ficheiro substituído.'));
  }

  private failPending(error: Error): void {
    this.pending.forEach(({ reject }) => reject(error));
    this.pending.clear();
  }
}
