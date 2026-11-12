import { Worker } from 'node:worker_threads';
import type { ScheduleRequest, ScheduleResult, WorkerReply } from './schedule-worker.js';

// Each operation owns its worker until settlement; no background service or database
// handle survives a tool call. This also keeps imports/SQL off the Gateway event loop.
export async function scheduleWork(request: ScheduleRequest, signal: AbortSignal | undefined, assertCurrent: () => void): Promise<ScheduleResult> {
  signal?.throwIfAborted();
  assertCurrent();
  const worker = new Worker(new URL('./schedule-worker.js', import.meta.url), { workerData: request, resourceLimits: { maxOldGenerationSizeMb: 384 } });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    return await new Promise<ScheduleResult>((resolve, reject) => {
      abort = () => reject(signal?.reason ?? new Error('Transit operation canceled.'));
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => reject(new Error('Transit schedule operation timed out.')), 120_000);
      worker.once('message', (reply: WorkerReply) => reply.ok ? resolve(reply.result) : reject(new Error(reply.error)));
      worker.once('error', reject);
      worker.once('exit', code => { if (code !== 0) reject(new Error('Transit worker exited: ' + code)); });
    });
  } finally {
    if (timer) clearTimeout(timer);
    if (abort) signal?.removeEventListener('abort', abort);
    await worker.terminate();
  }
}
