import { fetchWithSsrFGuard } from 'openclaw/plugin-sdk/ssrf-runtime';
import type { CallScope, FetchBytes } from './types.js';

export const fetchBytes: FetchBytes = async (url, maxBytes, scope: CallScope) => {
  scope.assertCurrent();
  const result = await fetchWithSsrFGuard({ url, signal: scope.signal, timeoutMs: 60_000,
    beforeRequest: scope.assertCurrent,
    init: { headers: { 'user-agent': 'Hopper-GTFS/0.1 (+https://github.com/DonnieFi/agent-templates)' } },
  });
  try {
    if (!result.response.ok) throw new Error('Transit download failed: HTTP ' + result.response.status);
    const declared = Number(result.response.headers.get('content-length'));
    if (declared > maxBytes) throw new Error('Transit download exceeds the supported size limit.');
    if (!result.response.body) throw new Error('Transit response has no body.');
    const reader = result.response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        scope.signal?.throwIfAborted();
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > maxBytes) throw new Error('Transit download exceeds the supported size limit.');
        chunks.push(next.value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    scope.assertCurrent();
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally { await result.release(); }
};
