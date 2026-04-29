import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const DEFAULT_INPUT = '.build/digest.md';
const DEFAULT_CONTENT_DIR = 'content/posts';
const DEFAULT_STATIC_DIR = 'static';

interface PrepareConfig {
  inputPath: string;
  contentDir: string;
  staticDir: string;
}

interface IndexEntry {
  link?: string;
  date?: string;
  [key: string]: unknown;
}

function parseArgs(argv: string[]): PrepareConfig {
  let inputPath = DEFAULT_INPUT;
  let contentDir = DEFAULT_CONTENT_DIR;
  let staticDir = DEFAULT_STATIC_DIR;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--input' && argv[i + 1]) inputPath = argv[++i]!;
    else if (arg === '--content-dir' && argv[i + 1]) contentDir = argv[++i]!;
    else if (arg === '--static-dir' && argv[i + 1]) staticDir = argv[++i]!;
    else if (arg === '--keep') {
      i++;
      console.warn('[prepare-hugo] --keep is deprecated and ignored. All posts are now retained.');
    }
  }

  return { inputPath, contentDir, staticDir };
}

function extractDate(markdown: string): string {
  const match = markdown.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
  return match?.[1] || new Date().toISOString().slice(0, 10);
}

function normalizeLink(link: string): string {
  return link.replace(/\/+$/, '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
}

async function loadExistingIndex(indexPath: string): Promise<IndexEntry[]> {
  let raw: string;
  try {
    raw = await readFile(indexPath, 'utf8');
  } catch {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`[prepare-hugo] search-index.json is not an array, resetting index`);
      return [];
    }
    return parsed as IndexEntry[];
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[prepare-hugo] search-index.json is corrupted (${msg}), preserving backup`);
    const backupPath = indexPath + '.bak';
    await writeFile(backupPath, raw!).catch(() => {});
    console.warn(`[prepare-hugo] Backup saved to ${backupPath}`);
    return [];
  }
}

function mergeIndex(existing: IndexEntry[], incoming: IndexEntry[]): IndexEntry[] {
  const byLink = new Map<string, IndexEntry>();

  for (const entry of existing) {
    const key = entry.link ? normalizeLink(entry.link) : '';
    if (key) byLink.set(key, entry);
  }

  for (const entry of incoming) {
    const key = entry.link ? normalizeLink(entry.link) : '';
    if (key) byLink.set(key, entry);
  }

  return Array.from(byLink.values())
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));

  const markdown = await readFile(config.inputPath, 'utf8');
  const date = extractDate(markdown);

  await mkdir(config.contentDir, { recursive: true });
  const postPath = join(config.contentDir, `${date}.md`);
  await writeFile(postPath, markdown);
  console.log(`[prepare-hugo] Written post: ${postPath}`);

  const articlesPath = config.inputPath.replace(/\.md$/, '.articles.json');
  let newArticles: IndexEntry[] = [];
  try {
    const raw = await readFile(articlesPath, 'utf8');
    newArticles = JSON.parse(raw) as IndexEntry[];
  } catch {
    console.warn(`[prepare-hugo] No articles.json found at ${articlesPath}`);
  }

  await mkdir(config.staticDir, { recursive: true });
  const indexPath = join(config.staticDir, 'search-index.json');
  const existingIndex = await loadExistingIndex(indexPath);
  const merged = mergeIndex(existingIndex, newArticles);

  await writeFile(indexPath, JSON.stringify(merged) + '\n');
  console.log(`[prepare-hugo] Updated search index: ${merged.length} total articles (${newArticles.length} new, ${existingIndex.length} existing)`);

  const files = await readdir(config.contentDir);
  const postCount = files.filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).length;
  console.log(`[prepare-hugo] Done. Total posts: ${postCount}`);
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[prepare-hugo] Fatal error: ${message}`);
  process.exit(1);
});
