import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';

const SHARE_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  + '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>'
  + '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'
  + '</svg>';

function generateShareId(link: string): string {
  return createHash('sha256').update(link).digest('hex').slice(0, 8);
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shareInlineButton(opts: {
  dateStr: string;
  shareId: string;
  pageTitle: string;
  itemTitle: string;
}): string {
  return ' <button class="share-item-btn share-inline" type="button" aria-label="分享此条"'
    + ` data-share-url="/share/${opts.dateStr}/${opts.shareId}/"`
    + ` data-share-id="${opts.shareId}"`
    + ` data-title="${escapeHtmlAttr(opts.pageTitle)}"`
    + ` data-item-title="${escapeHtmlAttr(opts.itemTitle)}"`
    + ` title="分享此条">${SHARE_ICON_SVG}</button>`;
}

function yamlQuote(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');
}

interface ShareInfo {
  shareId: string;
  link: string;
  titleZh: string;
  titleEn: string;
  source: string;
  summary: string;
}

const MEDAL_RE = /^([\u{1F947}\u{1F948}\u{1F949}])/u;

function lookaheadDetail(
  lines: string[],
  start: number,
  maxScan: number,
): { titleEn: string; link: string; source: string; summary: string } | null {
  let detail: { titleEn: string; link: string; source: string } | null = null;
  let summary = '';
  for (let j = start; j < Math.min(start + maxScan, lines.length); j++) {
    const line = lines[j]!;
    if (!detail) {
      const boldM = line.match(/^\[(.+)\]\(([^)\s]+)\)\s*—\s*\*\*([^*]+)\*\*/);
      if (boldM) {
        detail = { titleEn: boldM[1]!, link: boldM[2]!, source: boldM[3]!.trim() };
        continue;
      }
      const plainM = line.match(/^\[(.+)\]\(([^)\s]+)\)\s*—\s*([^·]+?)\s*·/);
      if (plainM) {
        detail = { titleEn: plainM[1]!, link: plainM[2]!, source: plainM[3]!.trim() };
        continue;
      }
    } else if (!summary) {
      const sm = line.match(/^>\s+(.+?)\s*$/);
      if (sm) {
        summary = sm[1]!;
        break;
      }
    }
  }
  return detail ? { ...detail, summary } : null;
}

function extractFrontMatter(md: string): { dateStr: string; pageTitle: string } {
  const dateM = md.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})/m);
  const titleM = md.match(/^title:\s*"(.+)"\s*$/m);
  return {
    dateStr: dateM?.[1] ?? '',
    pageTitle: titleM?.[1] ?? '',
  };
}

async function retrofitPost(date: string, postDir: string): Promise<ShareInfo[]> {
  const path = join(postDir, 'index.md');
  let md: string;
  try {
    md = await readFile(path, 'utf8');
  } catch {
    return [];
  }

  const { pageTitle: rawPageTitle } = extractFrontMatter(md);
  const pageTitle = rawPageTitle || `AI 博客每日精选 — ${date}`;

  // Strip existing anchors and inline buttons (idempotent)
  let body = md;
  body = body.replace(
    /^(### \d+\..+?)[ \t]*\{#item-[0-9a-f]+\}[ \t]*$/gm,
    '$1',
  );
  body = body.replace(
    /^([\u{1F947}\u{1F948}\u{1F949}][ \t]+\*\*[^*]+\*\*)[ \t]+<button class="share-item-btn[^"]*"[^>]*>.*?<\/button>[ \t]*$/gmu,
    '$1',
  );

  const sharesByLink = new Map<string, ShareInfo>();
  const lines = body.split('\n');
  const out: string[] = [];

  const pushBlankIfMissing = (i: number) => {
    if (i + 1 < lines.length && lines[i + 1]!.trim() !== '') {
      out.push('');
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const headingM = line.match(/^(### \d+)\.\s+(.+?)\s*$/);
    if (headingM) {
      const headingPrefix = headingM[1]!;
      const titleZh = headingM[2]!;
      const detail = lookaheadDetail(lines, i + 1, 8);
      if (detail) {
        const shareId = generateShareId(detail.link);
        sharesByLink.set(detail.link, {
          shareId,
          link: detail.link,
          titleZh,
          titleEn: detail.titleEn,
          source: detail.source,
          summary: detail.summary,
        });
        out.push(`${headingPrefix}. ${titleZh} {#item-${shareId}}`);
        pushBlankIfMissing(i);
        continue;
      }
    }

    const medalM = line.match(MEDAL_RE);
    if (medalM) {
      const titleM = line.match(/^([\u{1F947}\u{1F948}\u{1F949}])\s+\*\*(.+?)\*\*\s*$/u);
      if (titleM) {
        const medal = titleM[1]!;
        const titleZh = titleM[2]!;
        const detail = lookaheadDetail(lines, i + 1, 5);
        if (detail) {
          const shareId = generateShareId(detail.link);
          if (!sharesByLink.has(detail.link)) {
            sharesByLink.set(detail.link, {
              shareId,
              link: detail.link,
              titleZh,
              titleEn: detail.titleEn,
              source: detail.source,
              summary: detail.summary,
            });
          }
          const btn = shareInlineButton({ dateStr: date, shareId, pageTitle, itemTitle: titleZh });
          out.push(`${medal} **${titleZh}**${btn}`);
          pushBlankIfMissing(i);
          continue;
        }
      }
    }

    out.push(line);
  }

  const newMd = out.join('\n');
  if (newMd !== md) {
    await writeFile(path, newMd);
    console.log(`[retrofit] Updated ${path}`);
  }

  return Array.from(sharesByLink.values());
}

async function generateShareLandingPages(date: string, shares: ShareInfo[]): Promise<number> {
  let written = 0;
  for (const s of shares) {
    const dir = join('content', 'share', date, s.shareId);
    await mkdir(dir, { recursive: true });
    const fm = `---
title: "${yamlQuote(s.titleZh)}"
date: "${date}T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "${yamlQuote(s.summary.slice(0, 300))}"
source: "${yamlQuote(s.source)}"
shareId: "${s.shareId}"
targetUrl: "/posts/${date}/#item-${s.shareId}"
originalUrl: "${yamlQuote(s.link)}"
titleEn: "${yamlQuote(s.titleEn)}"
---
`;
    const indexPath = join(dir, 'index.md');
    let existing = '';
    try { existing = await readFile(indexPath, 'utf8'); } catch { /* new */ }
    if (existing !== fm) {
      await writeFile(indexPath, fm);
      written++;
    }
  }
  return written;
}

async function ensureShareIndex(): Promise<void> {
  const shareIndexDir = 'content/share';
  await mkdir(shareIndexDir, { recursive: true });
  const shareIndexPath = join(shareIndexDir, '_index.md');
  try {
    await readFile(shareIndexPath, 'utf8');
  } catch {
    await writeFile(shareIndexPath, `---
title: ""
build:
  list: never
  render: never
---
`);
  }
}

async function main(): Promise<void> {
  const contentDir = 'content/posts';
  let dirs: string[];
  try {
    dirs = await readdir(contentDir);
  } catch {
    console.warn(`[retrofit] No ${contentDir} directory`);
    return;
  }

  await ensureShareIndex();

  let totalShares = 0;
  let totalWritten = 0;
  let processed = 0;
  for (const d of dirs.sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const shares = await retrofitPost(d, join(contentDir, d));
    if (shares.length === 0) continue;
    const written = await generateShareLandingPages(d, shares);
    totalShares += shares.length;
    totalWritten += written;
    processed++;
    console.log(`[retrofit] ${d}: ${shares.length} articles, ${written} share pages written`);
  }
  console.log(`[retrofit] Done. Posts processed: ${processed}, articles: ${totalShares}, share pages written: ${totalWritten}`);
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[retrofit] Fatal error: ${message}`);
  process.exit(1);
});
