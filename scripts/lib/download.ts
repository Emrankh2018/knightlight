import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

/** Returns the size of a file in bytes, or 0 when it does not exist. */
export async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

/**
 * Streams `url` to `dest` (via a `.part` file so a failed run never leaves a
 * truncated file under the final name). Reuses `dest` if it already exists
 * with at least `minBytes`. Makes two attempts in total.
 */
export async function downloadToFile(url: string, dest: string, minBytes: number): Promise<void> {
  const existing = await fileSize(dest);
  if (existing > 0 && existing >= minBytes) {
    console.log(`Reusing cached ${dest} (${(existing / 1e6).toFixed(1)} MB)`);
    return;
  }
  await mkdir(dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`Downloading ${url} (attempt ${attempt})`);
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
      const total = Number(res.headers.get('content-length') ?? 0);
      let received = 0;
      let nextReport = 0.1;
      const source = Readable.fromWeb(res.body as unknown as NodeReadableStream<Uint8Array>);
      source.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (total > 0 && received / total >= nextReport) {
          console.log(`  downloaded ${(received / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB`);
          nextReport += 0.1;
        }
      });
      await pipeline(source, createWriteStream(part));
      if (received < minBytes) throw new Error(`Download too small: ${received} bytes (< ${minBytes})`);
      await rename(part, dest);
      return;
    } catch (err) {
      lastError = err;
      console.error(`  download failed: ${err instanceof Error ? err.message : String(err)}`);
      await rm(part, { force: true });
    }
  }
  throw new Error(`Download failed twice for ${url}`, { cause: lastError });
}
