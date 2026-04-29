import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import process from 'node:process';

const DEFAULT_INPUT = '.build/digest.md';
const DEFAULT_CONTENT_DIR = 'content/posts';
const DEFAULT_STATIC_DIR = 'static';
const DEFAULT_KEEP = 30;

interface PrepareConfig {
  inputPath: string;
  contentDir: string;
  staticDir: string;
  keep: number;
}

function parseArgs(argv: string[]): PrepareConfig {
  let inputPath = DEFAULT_INPUT;
  let contentDir = DEFAULT_CONTENT_DIR;
  let staticDir = DEFAULT_STATIC_DIR;
  let keep = DEFAULT_KEEP;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--input' && argv[i + 1]) inputPath = argv[++i]!;
    else if (arg === '--content-dir' && argv[i + 1]) contentDir = argv[++i]!;
    else if (arg === '--static-dir' && argv[i + 1]) staticDir = argv[++i]!;
    else if (arg === '--keep' && argv[i + 1]) keep = parseInt(argv[++i]!, 10);
  }

  return { inputPath, contentDir, staticDir, keep };
}

function extractDate(markdown: string): string {
  const match = markdown.match(/^date:\s*(\d{4}-\d{2}-\d{2})/m);
  return match?.[1] || new Date().toISOString().slice(0, 10);
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
  let newArticles: unknown[] = [];
  try {
    const raw = await readFile(articlesPath, 'utf8');
    newArticles = JSON.parse(raw) as unknown[];
  } catch {
    console.warn(`[prepare-hugo] No articles.json found at ${articlesPath}`);
  }

  await mkdir(config.staticDir, { recursive: true });
  const indexPath = join(config.staticDir, 'search-index.json');
  let existingIndex: Array<{ date?: string }> = [];
  try {
    const raw = await readFile(indexPath, 'utf8');
    existingIndex = JSON.parse(raw) as Array<{ date?: string }>;
  } catch {
    // First run
  }

  const merged = [
    ...newArticles as Array<{ date?: string }>,
    ...existingIndex.filter(item => item.date !== date),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  await writeFile(indexPath, JSON.stringify(merged) + '\n');
  console.log(`[prepare-hugo] Updated search index: ${merged.length} articles`);

  const files = await readdir(config.contentDir);
  const postFiles = files
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse();

  if (postFiles.length > config.keep) {
    const toRemove = postFiles.slice(config.keep);
    for (const file of toRemove) {
      await rm(join(config.contentDir, file));
      console.log(`[prepare-hugo] Pruned old post: ${file}`);
    }

    const keptDates = new Set(postFiles.slice(0, config.keep).map(f => f.replace('.md', '')));
    const prunedIndex = merged.filter(item => keptDates.has(item.date || ''));
    await writeFile(indexPath, JSON.stringify(prunedIndex) + '\n');
  }

  console.log(`[prepare-hugo] Done. Posts kept: ${Math.min(postFiles.length, config.keep)}`);
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[prepare-hugo] Fatal error: ${message}`);
  process.exit(1);
});
