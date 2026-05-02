import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export function generateShareId(link: string): string {
  return createHash('sha256').update(link).digest('hex').slice(0, 8);
}

export function topItemAnchor(shareId: string): string {
  return ` <a id="item-${shareId}" class="x-anchor" aria-hidden="true"></a>`;
}

export function yamlQuote(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');
}

export interface ShareLandingMeta {
  shareId: string;
  date: string;
  titleZh: string;
  titleEn: string;
  source: string;
  summary: string;
  originalUrl: string;
}

/**
 * Idempotently write a single share landing page.
 * Returns true if the file was created or content changed; false if unchanged.
 */
export async function writeShareLandingPage(meta: ShareLandingMeta): Promise<boolean> {
  const dir = join('content', 'share', meta.date, meta.shareId);
  await mkdir(dir, { recursive: true });
  const fm = `---
title: "${yamlQuote(meta.titleZh)}"
date: "${meta.date}T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "${yamlQuote(meta.summary.slice(0, 300))}"
source: "${yamlQuote(meta.source)}"
shareId: "${meta.shareId}"
targetUrl: "/posts/${meta.date}/#item-${meta.shareId}"
originalUrl: "${yamlQuote(meta.originalUrl)}"
titleEn: "${yamlQuote(meta.titleEn)}"
---
`;
  const indexPath = join(dir, 'index.md');
  let existing = '';
  try { existing = await readFile(indexPath, 'utf8'); } catch { /* new file */ }
  if (existing === fm) return false;
  await writeFile(indexPath, fm);
  return true;
}

/**
 * Ensure content/share/_index.md exists so Hugo suppresses section listing & RSS.
 */
export async function ensureShareIndex(): Promise<void> {
  const dir = 'content/share';
  await mkdir(dir, { recursive: true });
  const indexPath = join(dir, '_index.md');
  try {
    await readFile(indexPath, 'utf8');
  } catch {
    await writeFile(indexPath, `---
title: ""
build:
  list: never
  render: never
---
`);
  }
}
