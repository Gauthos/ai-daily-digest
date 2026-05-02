import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import {
  generateShareId, topItemAnchor,
  writeShareLandingPage, ensureShareIndex,
} from './share-utils.js';

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

async function retrofitPost(date: string, postDir: string): Promise<ShareInfo[]> {
  const path = join(postDir, 'index.md');
  let md: string;
  try {
    md = await readFile(path, 'utf8');
  } catch {
    return [];
  }

  // Strip existing anchors, inline buttons, inline anchors (idempotent)
  let body = md;
  body = body.replace(
    /^(### \d+\..+?)[ \t]*\{#item-[0-9a-f]+\}[ \t]*$/gm,
    '$1',
  );
  body = body.replace(
    /^([\u{1F947}\u{1F948}\u{1F949}][ \t]+\*\*[^*]+\*\*)[ \t]+<button class="share-item-btn[^"]*"[^>]*>.*?<\/button>[ \t]*$/gmu,
    '$1',
  );
  body = body.replace(
    /^([\u{1F947}\u{1F948}\u{1F949}][ \t]+\*\*[^*]+\*\*)[ \t]+<a id="item-[0-9a-f]+"[^>]*><\/a>[ \t]*$/gmu,
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
          out.push(`${medal} **${titleZh}**${topItemAnchor(shareId)}`);
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

async function writeAllLandingPages(date: string, shares: ShareInfo[]): Promise<number> {
  let written = 0;
  for (const s of shares) {
    const changed = await writeShareLandingPage({
      shareId: s.shareId,
      date,
      titleZh: s.titleZh,
      titleEn: s.titleEn,
      source: s.source,
      summary: s.summary,
      originalUrl: s.link,
    });
    if (changed) written++;
  }
  return written;
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
    const written = await writeAllLandingPages(d, shares);
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
