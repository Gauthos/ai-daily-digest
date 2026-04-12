import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';

const DEFAULT_INPUT_PATH = '.build/digest.md';
const DEFAULT_OUTPUT_DIR = 'docs';
const DEFAULT_KEEP = 30;
const SITE_TITLE = 'AI Daily Digest';
const SITE_DESCRIPTION = 'AI-curated daily digest built from top technical blogs and published as a static RSS feed.';
const HAWAII_TIME_ZONE = 'Pacific/Honolulu';

const HAWAII_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: HAWAII_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

interface ManifestItem {
  date: string;
  title: string;
  urlPath: string;
  markdownPath: string;
  excerpt: string;
  contentHtml: string;
  publishedAt: string;
}

interface ManifestFile {
  siteUrl: string;
  generatedAt: string;
  items: ManifestItem[];
}

interface PublishConfig {
  inputPath: string;
  outputDir: string;
  siteUrl: string;
  keep: number;
}

interface ParsedDigest {
  date: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  markdown: string;
}

function printUsage(): never {
  console.log(`Publish generated digest to a GitHub Pages-friendly static site.

Usage:
  bun scripts/publish.ts [options]

Options:
  --input <path>       Markdown input path (default: ./.build/digest.md)
  --output-dir <path>  Pages output directory (default: ./docs)
  --site-url <url>     Public site URL (default: inferred from GitHub Actions env)
  --keep <n>           Number of digest entries to keep in feed/manifest (default: 30)
  --help               Show this help

Examples:
  bun scripts/publish.ts --site-url https://example.github.io/ai-daily-digest
  bun scripts/publish.ts --input ./digest.md --output-dir ./docs --keep 14 --site-url https://example.com
`);
  process.exit(0);
}

function parseArgs(argv: string[]): PublishConfig {
  let inputPath = DEFAULT_INPUT_PATH;
  let outputDir = DEFAULT_OUTPUT_DIR;
  let siteUrl = '';
  let keep = DEFAULT_KEEP;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') {
      printUsage();
    }
    if (arg === '--input' && argv[i + 1]) {
      inputPath = argv[++i]!;
    } else if (arg === '--output-dir' && argv[i + 1]) {
      outputDir = argv[++i]!;
    } else if (arg === '--site-url' && argv[i + 1]) {
      siteUrl = argv[++i]!;
    } else if (arg === '--keep' && argv[i + 1]) {
      keep = Number.parseInt(argv[++i]!, 10);
    }
  }

  if (!Number.isFinite(keep) || keep <= 0) {
    throw new Error(`Invalid --keep value: ${keep}`);
  }

  return {
    inputPath,
    outputDir,
    siteUrl: normalizeSiteUrl(siteUrl || inferSiteUrl()),
    keep,
  };
}

function inferSiteUrl(): string {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit;

  const repo = process.env.GITHUB_REPOSITORY?.trim();
  const owner = process.env.GITHUB_REPOSITORY_OWNER?.trim() || repo?.split('/')[0];
  if (!repo || !owner) {
    throw new Error('Missing public site URL. Pass --site-url or set SITE_URL/GITHUB_REPOSITORY[_OWNER].');
  }

  const repoName = repo.split('/')[1];
  if (!repoName) {
    throw new Error(`Could not infer repository name from GITHUB_REPOSITORY=${repo}`);
  }

  if (repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
    return `https://${owner}.github.io`;
  }

  return `https://${owner}.github.io/${repoName}`;
}

function normalizeSiteUrl(siteUrl: string): string {
  const normalized = siteUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(normalized)) {
    throw new Error(`site URL must start with http:// or https://: ${siteUrl}`);
  }
  return normalized;
}

function joinUrl(siteUrl: string, urlPath: string): string {
  const trimmedPath = urlPath.replace(/^\/+/, '');
  return `${siteUrl}/${trimmedPath}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(text: string): string {
  return escapeHtml(text);
}

function sanitizeCdata(text: string): string {
  return text.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatHawaiiDate(date: Date): string {
  const values = new Map<string, string>();

  for (const part of HAWAII_DATE_FORMATTER.formatToParts(date)) {
    if (part.type !== 'literal') {
      values.set(part.type, part.value);
    }
  }

  const year = values.get('year') || '0000';
  const month = values.get('month') || '01';
  const day = values.get('day') || '01';
  return `${year}-${month}-${day}`;
}

function isPromotionalFooterLine(line: string): boolean {
  const normalized = line.trim();
  return normalized.includes('懂点儿AI') || normalized.includes('微信公众号');
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[>#*_`|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderInlineMarkdown(text: string): string {
  const placeholders = new Map<string, string>();
  let nextId = 0;

  const reserve = (html: string): string => {
    const key = `@@INLINE_${nextId++}@@`;
    placeholders.set(key, html);
    return key;
  };

  let output = text;
  output = output.replace(/`([^`]+)`/g, (_, code: string) => reserve(`<code>${escapeHtml(code)}</code>`));
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, url: string) => {
    return reserve(`<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`);
  });

  output = escapeHtml(output);
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  for (const [key, value] of placeholders.entries()) {
    output = output.replaceAll(key, value);
  }

  return output;
}

function isSpecialLine(current: string, next?: string): boolean {
  const trimmed = current.trim();
  if (!trimmed) return true;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (trimmed === '---') return true;
  if (trimmed.startsWith('```')) return true;
  if (trimmed.startsWith('>')) return true;
  if (trimmed === '<details>') return true;
  if (/^[-*+]\s+/.test(trimmed)) return true;
  if (/^\d+\.\s+/.test(trimmed)) return true;
  if (trimmed.startsWith('|') && next && /^\|[\s:|-]+\|$/.test(next.trim())) return true;
  return false;
}

function renderTable(tableLines: string[]): string {
  const rows = tableLines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()));

  if (rows.length < 2) return '';

  const header = rows[0] || [];
  const body = rows.slice(2);

  let html = '<table><thead><tr>';
  for (const cell of header) {
    html += `<th>${renderInlineMarkdown(cell)}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const row of body) {
    html += '<tr>';
    for (const cell of row) {
      html += `<td>${renderInlineMarkdown(cell)}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];

  for (let i = 0; i < lines.length;) {
    const currentLine = lines[i] ?? '';
    const trimmed = currentLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      i++;
      blocks.push(`<pre><code class="language-${escapeHtml(lang || 'text')}">${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    if (trimmed === '<details>') {
      const detailLines: string[] = [];
      i++;
      while (i < lines.length && (lines[i] ?? '').trim() !== '</details>') {
        detailLines.push(lines[i] ?? '');
        i++;
      }
      i++;

      let summary = 'Details';
      let bodyStart = 0;
      const firstDetailLine = detailLines[0]?.trim() || '';
      const summaryMatch = firstDetailLine.match(/^<summary>([\s\S]+)<\/summary>$/);
      if (summaryMatch) {
        summary = summaryMatch[1] || summary;
        bodyStart = 1;
      }

      const bodyMarkdown = detailLines.slice(bodyStart).join('\n').trim();
      blocks.push(`<details><summary>${renderInlineMarkdown(summary)}</summary>${bodyMarkdown ? renderMarkdown(bodyMarkdown) : ''}</details>`);
      continue;
    }

    if (trimmed.startsWith('|') && /^\|[\s:|-]+\|$/.test((lines[i + 1] ?? '').trim())) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        tableLines.push(lines[i] ?? '');
        i++;
      }
      blocks.push(renderTable(tableLines));
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]?.length || 1;
      const text = headingMatch[2] || '';
      blocks.push(`<h${level}>${renderInlineMarkdown(text)}</h${level}>`);
      i++;
      continue;
    }

    if (trimmed === '---') {
      blocks.push('<hr />');
      i++;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('>')) {
        quoteLines.push((lines[i] ?? '').trim().replace(/^>\s?/, ''));
        i++;
      }
      const quoteHtml = quoteLines.map((line) => renderInlineMarkdown(line)).join('<br />');
      blocks.push(`<blockquote><p>${quoteHtml}</p></blockquote>`);
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const tag = ordered ? 'ol' : 'ul';
      const items: string[] = [];
      while (i < lines.length) {
        const candidate = (lines[i] ?? '').trim();
        const pattern = ordered ? /^\d+\.\s+(.+)$/ : /^[-*+]\s+(.+)$/;
        const match = candidate.match(pattern);
        if (!match) break;
        items.push(`<li>${renderInlineMarkdown(match[1] || '')}</li>`);
        i++;
      }
      blocks.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const line = lines[i] ?? '';
      const nextLine = lines[i + 1];
      if (line.trim() === '') break;
      if (paragraphLines.length > 0 && isSpecialLine(line, nextLine)) break;
      paragraphLines.push(line.trim());
      i++;
      if (i < lines.length && isSpecialLine(lines[i] ?? '', lines[i + 1])) break;
    }
      
    if (paragraphLines.length > 0) {
      blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join(' '))}</p>`);
      continue;
    }

    i++;
  }

  return blocks.join('\n');
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || SITE_TITLE;
}

function extractDate(title: string): string {
  const match = title.match(/(\d{4}-\d{2}-\d{2})/);
  if (match?.[1]) return match[1];
  return formatHawaiiDate(new Date());
}

function extractExcerpt(markdown: string): string {
  const highlightsMatch = markdown.match(/^##\s+📝\s+今日看点\s*\n\n([\s\S]*?)\n\n---/m);
  const source = highlightsMatch?.[1] || markdown;
  const plain = stripMarkdown(source);
  if (!plain) return SITE_DESCRIPTION;
  return plain.slice(0, 280);
}

function stripFooterAds(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !isPromotionalFooterLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function stripFooterAdsFromHtml(html: string): string {
  const promotionalEmphasisPattern = /\s*<em>[^<]*(?:懂点儿AI|微信公众号)[^<]*<\/em>/g;
  const promotionalTextPattern = /[^<]*(?:懂点儿AI|微信公众号)[^<]*/g;

  return html
    .replace(promotionalEmphasisPattern, '')
    .replace(promotionalTextPattern, '')
    .replace(/<p>\s*<\/p>/g, '');
}

function sanitizeManifestItem(item: ManifestItem): ManifestItem {
  return {
    ...item,
    excerpt: isPromotionalFooterLine(item.excerpt) ? '' : item.excerpt,
    contentHtml: stripFooterAdsFromHtml(item.contentHtml),
  };
}

function parseDigest(markdown: string): ParsedDigest {
  const normalizedMarkdown = stripFooterAds(markdown);
  const title = extractTitle(normalizedMarkdown);
  return {
    title,
    date: extractDate(title),
    excerpt: extractExcerpt(normalizedMarkdown),
    contentHtml: renderMarkdown(normalizedMarkdown),
    markdown: normalizedMarkdown,
  };
}

function toRfc2822(isoTimestamp: string): string {
  return new Date(isoTimestamp).toUTCString();
}

function renderPageLayout(params: {
  pageTitle: string;
  siteUrl: string;
  canonicalPath: string;
  bodyClass?: string;
  bodyHtml: string;
}): string {
  const canonicalUrl = joinUrl(params.siteUrl, params.canonicalPath);
  const feedUrl = joinUrl(params.siteUrl, 'feed.xml');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.pageTitle)}</title>
  <meta name="description" content="${escapeHtml(SITE_DESCRIPTION)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_TITLE)}" href="${escapeHtml(feedUrl)}" />
  <style>
    :root {
      /* Apple Design System Colors */
      --color-black: #000000;
      --color-light-gray: #f5f5f7;
      --color-near-black: #1d1d1f;
      --color-apple-blue: #0071e3;
      --color-link-blue: #0066cc;
      --color-link-blue-bright: #2997ff;
      --color-text-secondary: rgba(0, 0, 0, 0.8);
      --color-text-tertiary: rgba(0, 0, 0, 0.48);
      --color-dark-surface: #272729;
      --color-white: #ffffff;
      --color-line: rgba(0, 0, 0, 0.1);
      --color-overlay: rgba(210, 210, 215, 0.64);
      --color-code-bg: #f5f5f7;
      --shadow-card: rgba(0, 0, 0, 0.12) 0px 4px 20px 0px;
      --shadow-elevated: rgba(0, 0, 0, 0.22) 3px 5px 30px 0px;

      /* Spacing (8px base) */
      --space-4: 4px;
      --space-8: 8px;
      --space-12: 12px;
      --space-16: 16px;
      --space-20: 20px;
      --space-24: 24px;
      --space-32: 32px;
      --space-48: 48px;
      --space-56: 56px;
    }

    *, *::before, *::after { box-sizing: border-box; }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 17px;
      line-height: 1.47;
      letter-spacing: -0.022em;
      color: var(--color-near-black);
      background: var(--color-light-gray);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ── Typography ── */
    h1, h2, h3, h4, h5, h6 {
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-weight: 600;
      line-height: 1.1;
      letter-spacing: -0.02em;
      color: var(--color-near-black);
    }

    h1 { font-size: clamp(32px, 5vw, 52px); font-weight: 700; line-height: 1.05; letter-spacing: -0.03em; }
    h2 { font-size: clamp(24px, 3.5vw, 36px); }
    h3 { font-size: 21px; font-weight: 600; line-height: 1.2; letter-spacing: -0.01em; }
    h4 { font-size: 17px; font-weight: 600; }

    p { margin: 0 0 1em; }

    a {
      color: var(--color-link-blue);
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
    a:focus-visible {
      outline: 2px solid var(--color-apple-blue);
      outline-offset: 3px;
      border-radius: 2px;
    }

    /* ── Layout Shell ── */
    .shell {
      width: min(980px, calc(100% - 32px));
      margin: 0 auto;
      padding: var(--space-32) var(--space-16) var(--space-56);
    }

    /* ── Cards ── */
    .card {
      background: var(--color-white);
      border-radius: var(--radius-large, 18px);
      box-shadow: var(--shadow-card);
      overflow: hidden;
    }

    .masthead {
      padding: var(--space-48) var(--space-32) var(--space-32);
      margin-bottom: var(--space-16);
      background: var(--color-white);
      border-radius: 24px;
      box-shadow: var(--shadow-card);
    }

    .kicker {
      font-size: 14px;
      font-weight: 400;
      letter-spacing: -0.01em;
      color: var(--color-text-tertiary);
      margin-bottom: var(--space-8);
    }

    .masthead p,
    .meta {
      color: var(--color-text-secondary);
      margin: 0;
      font-size: 17px;
    }

    .action-row {
      margin-top: var(--space-20);
      display: flex;
      gap: var(--space-8);
      flex-wrap: wrap;
    }

    .action-row a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: var(--space-8) var(--space-16);
      background: var(--color-apple-blue);
      color: var(--color-white);
      border-radius: 980px;
      font-size: 15px;
      font-weight: 400;
      text-decoration: none;
      transition: background 0.2s ease;
    }
    .action-row a:hover {
      background: #0077ed;
      text-decoration: none;
    }
    .action-row a:focus-visible {
      outline: 2px solid var(--color-apple-blue);
      outline-offset: 3px;
    }

    /* ── Two-column layout ── */
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(220px, 0.8fr);
      gap: var(--space-16);
      align-items: start;
    }

    /* ── Main Digest ── */
    .digest {
      background: var(--color-white);
      border-radius: 24px;
      box-shadow: var(--shadow-card);
      padding: var(--space-32);
      overflow-x: auto;
    }

    .digest > *:first-child { margin-top: 0; }
    .digest > *:last-child { margin-bottom: 0; }

    .digest h1,
    .digest h2 {
      margin: 1.5em 0 0.5em;
    }
    .digest h1:first-child,
    .digest h2:first-child { margin-top: 0; }

    /* ── Sidebar Panel ── */
    .panel {
      background: var(--color-white);
      border-radius: 24px;
      box-shadow: var(--shadow-card);
      padding: var(--space-24);
      position: sticky;
      top: var(--space-24);
    }

    .panel h2 {
      font-size: 21px;
      margin: 0 0 var(--space-16);
      padding-bottom: var(--space-12);
      border-bottom: 1px solid var(--color-line);
    }

    /* ── Archive List ── */
    .archive-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-12);
    }

    .archive-list li {
      padding: var(--space-12) 0;
      border-bottom: 1px solid var(--color-line);
    }
    .archive-list li:last-child { border-bottom: none; }

    .archive-list a {
      font-weight: 600;
      font-size: 15px;
      color: var(--color-near-black);
      text-decoration: none;
    }
    .archive-list a:hover { color: var(--color-apple-blue); text-decoration: none; }

    .archive-list p {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--color-text-tertiary);
    }

    .footer-note {
      margin-top: var(--space-20);
      padding-top: var(--space-16);
      border-top: 1px solid var(--color-line);
      font-size: 13px;
      color: var(--color-text-tertiary);
    }

    /* ── Content Elements ── */
    blockquote {
      margin: 1.2em 0;
      padding: 14px 18px;
      border-left: 4px solid var(--color-apple-blue);
      background: rgba(0, 113, 227, 0.05);
      border-radius: 0 8px 8px 0;
      color: var(--color-text-secondary);
    }
    blockquote p:last-child { margin-bottom: 0; }

    hr {
      border: 0;
      border-top: 1px solid var(--color-line);
      margin: var(--space-32) 0;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.2em 0;
      font-size: 15px;
      border-radius: 12px;
      overflow: hidden;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--color-line);
    }
    th {
      background: var(--color-light-gray);
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.01em;
      color: var(--color-text-secondary);
    }
    tr:last-child td { border-bottom: none; }

    /* ── Code ── */
    pre {
      overflow-x: auto;
      padding: var(--space-16);
      border-radius: 12px;
      background: var(--color-code-bg);
      border: 1px solid var(--color-line);
      font-size: 13px;
      line-height: 1.5;
    }
    code {
      font-family: 'SFMono-Regular', 'Menlo', 'Monaco', monospace;
      font-size: 0.9em;
    }
    p code,
    li code,
    td code,
    blockquote code {
      background: var(--color-code-bg);
      padding: 0.15em 0.4em;
      border-radius: 5px;
    }

    /* ── Details/Summary ── */
    details {
      margin: 1.2em 0;
      padding: var(--space-16);
      border-radius: 12px;
      background: var(--color-light-gray);
      border: 1px solid var(--color-line);
    }
    details summary {
      cursor: pointer;
      font-weight: 600;
      font-size: 15px;
    }
    details[open] summary { margin-bottom: var(--space-12); }

    /* ── Responsive ── */
    @media (max-width: 834px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .panel {
        position: static;
      }
      .masthead {
        padding: var(--space-32) var(--space-24);
      }
      .digest {
        padding: var(--space-24);
      }
      .shell {
        padding: var(--space-24) var(--space-12) var(--space-48);
      }
    }
  </style>
</head>
<body class="${escapeHtml(params.bodyClass || '')}">
  ${params.bodyHtml}
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
  </script>
</body>
</html>`;
}

function renderArchivePage(siteUrl: string, item: ManifestItem, archiveItems: ManifestItem[]): string {
  const archiveList = archiveItems.map((entry) => {
    const label = escapeHtml(entry.title);
    const link = escapeHtml(joinUrl(siteUrl, entry.urlPath));
    const excerpt = escapeHtml(entry.excerpt);
    return `<li><a href="${link}">${label}</a><p>${excerpt}</p></li>`;
  }).join('');

  const markdownUrl = joinUrl(siteUrl, item.markdownPath);
  const homeUrl = siteUrl;
  const feedUrl = joinUrl(siteUrl, 'feed.xml');

  const bodyHtml = `<main class="shell">
    <header class="masthead">
      <div class="kicker">Static Digest Feed <span>•</span> ${escapeHtml(item.date)}</div>
      <h1>${escapeHtml(item.title)}</h1>
      <p class="meta">每天一篇归档页，RSS 订阅和网页浏览共用同一份静态内容。</p>
      <div class="action-row">
        <a href="${escapeHtml(feedUrl)}">订阅 RSS</a>
        <a href="${escapeHtml(markdownUrl)}">查看 Markdown</a>
        <a href="${escapeHtml(homeUrl)}">返回首页</a>
      </div>
    </header>

    <section class="layout">
      <article class="digest">
        ${item.contentHtml}
      </article>

      <aside class="panel">
        <h2>归档</h2>
        <p class="archive-intro">保留最近 ${archiveItems.length} 篇 digest 条目，供阅读器和网页浏览共同使用。</p>
        <ul class="archive-list">${archiveList}</ul>
        <p class="footer-note">源文件：<a href="${escapeHtml(markdownUrl)}">${escapeHtml(item.markdownPath)}</a></p>
      </aside>
    </section>
  </main>`;

  return renderPageLayout({
    pageTitle: item.title,
    siteUrl,
    canonicalPath: item.urlPath,
    bodyClass: 'archive-page',
    bodyHtml,
  });
}

function renderIndexPage(siteUrl: string, items: ManifestItem[]): string {
  const latest = items[0];
  const archiveList = items.map((entry) => {
    const link = escapeHtml(joinUrl(siteUrl, entry.urlPath));
    const markdownLink = escapeHtml(joinUrl(siteUrl, entry.markdownPath));
    return `<li><a href="${link}">${escapeHtml(entry.title)}</a><p>${escapeHtml(entry.excerpt)} · <a href="${markdownLink}">Markdown</a></p></li>`;
  }).join('');

  const latestHtml = latest
    ? `<article class="digest">${latest.contentHtml}</article>`
    : `<article class="digest"><h2>等待首次生成</h2><p>GitHub Actions 第一次成功运行后，这里会显示最新日报，RSS 也会开始输出条目。</p></article>`;

  const bodyHtml = `<main class="shell">
    <header class="masthead">
      <div class="kicker">GitHub Pages <span>•</span> Static RSS</div>
      <h1>${escapeHtml(SITE_TITLE)}</h1>
      <p>这个页面发布由 AI 筛选生成的每日技术 digest，并维护一个可长期订阅的 <code>feed.xml</code>。</p>
      <div class="action-row">
        <a href="${escapeHtml(joinUrl(siteUrl, 'feed.xml'))}">订阅 RSS</a>
        ${latest ? `<a href="${escapeHtml(joinUrl(siteUrl, latest.urlPath))}">最新归档</a>` : ''}
      </div>
    </header>

    <section class="layout">
      ${latestHtml}

      <aside class="panel">
        <h2>归档列表</h2>
        <p class="archive-intro">GitHub Actions 每日运行一次，生成静态页面并发布到 docs 分支。</p>
        <ul class="archive-list">${archiveList || '<li><p>还没有归档条目。</p></li>'}</ul>
      </aside>
    </section>
  </main>`;

  return renderPageLayout({
    pageTitle: SITE_TITLE,
    siteUrl,
    canonicalPath: '',
    bodyClass: 'index-page',
    bodyHtml,
  });
}

function renderFeed(siteUrl: string, items: ManifestItem[]): string {
  const itemXml = items.map((item) => {
    const itemUrl = joinUrl(siteUrl, item.urlPath);
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(itemUrl)}</link>
      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>
      <pubDate>${escapeXml(toRfc2822(item.publishedAt))}</pubDate>
      <description><![CDATA[${sanitizeCdata(item.excerpt)}]]></description>
      <content:encoded><![CDATA[${sanitizeCdata(item.contentHtml)}]]></content:encoded>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>zh-CN</language>
    <generator>ai-daily-digest/scripts/publish.ts</generator>
    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
    <atom:link href="${escapeXml(joinUrl(siteUrl, 'feed.xml'))}" rel="self" type="application/rss+xml" />
${itemXml}
  </channel>
</rss>`;
}

async function readExistingManifest(outputDir: string): Promise<ManifestFile> {
  const manifestPath = join(outputDir, 'manifest.json');
  try {
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ManifestFile>;
    return {
      siteUrl: typeof parsed.siteUrl === 'string' ? parsed.siteUrl : '',
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
      items: Array.isArray(parsed.items) ? parsed.items.filter((item): item is ManifestItem => {
        return Boolean(
          item
          && typeof item.date === 'string'
          && typeof item.title === 'string'
          && typeof item.urlPath === 'string'
          && typeof item.markdownPath === 'string'
          && typeof item.excerpt === 'string'
          && typeof item.contentHtml === 'string'
          && typeof item.publishedAt === 'string'
        );
      }).map((item) => sanitizeManifestItem(item)) : [],
    };
  } catch {
    return { siteUrl: '', generatedAt: '', items: [] };
  }
}

async function writeTextFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function pruneOldArchives(outputDir: string, keptItems: ManifestItem[], previousItems: ManifestItem[]): Promise<void> {
  const keptDates = new Set(keptItems.map((item) => item.date));
  for (const item of previousItems) {
    if (keptDates.has(item.date)) continue;
    await rm(join(outputDir, 'digests', item.date), { recursive: true, force: true });
  }
}

async function sanitizeArchiveMarkdown(archiveDir: string): Promise<void> {
  const markdownPath = join(archiveDir, 'digest.md');

  try {
    const current = await readFile(markdownPath, 'utf8');
    const sanitized = stripFooterAds(current);
    if (sanitized !== current) {
      await writeTextFile(markdownPath, sanitized);
    }
  } catch {
    // Historical markdown is optional when bootstrapping from an empty docs branch.
  }
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const markdown = await readFile(config.inputPath, 'utf8');
  const parsedDigest = parseDigest(markdown);
  const existingManifest = await readExistingManifest(config.outputDir);

  const urlPath = `digests/${parsedDigest.date}/`;
  const markdownPath = `digests/${parsedDigest.date}/digest.md`;
  const existingItem = existingManifest.items.find((item) => item.date === parsedDigest.date);

  const nextItem: ManifestItem = {
    date: parsedDigest.date,
    title: parsedDigest.title,
    urlPath,
    markdownPath,
    excerpt: parsedDigest.excerpt,
    contentHtml: parsedDigest.contentHtml,
    publishedAt: existingItem?.publishedAt || new Date().toISOString(),
  };

  const mergedItems = [
    nextItem,
    ...existingManifest.items.filter((item) => item.date !== parsedDigest.date),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, config.keep);

  const nextManifest: ManifestFile = {
    siteUrl: config.siteUrl,
    generatedAt: new Date().toISOString(),
    items: mergedItems,
  };

  for (const item of mergedItems) {
    const archiveDir = join(config.outputDir, 'digests', item.date);
    await mkdir(archiveDir, { recursive: true });

    if (item.date === parsedDigest.date) {
      await writeTextFile(join(archiveDir, 'digest.md'), parsedDigest.markdown);
    } else {
      await sanitizeArchiveMarkdown(archiveDir);
    }

    await writeTextFile(join(archiveDir, 'index.html'), renderArchivePage(config.siteUrl, item, mergedItems));
  }

  await writeTextFile(join(config.outputDir, 'index.html'), renderIndexPage(config.siteUrl, mergedItems));
  await writeTextFile(join(config.outputDir, 'feed.xml'), renderFeed(config.siteUrl, mergedItems));
  await writeTextFile(join(config.outputDir, 'manifest.json'), JSON.stringify(nextManifest, null, 2) + '\n');
  await writeTextFile(join(config.outputDir, '.nojekyll'), '');

  await pruneOldArchives(config.outputDir, mergedItems, existingManifest.items);

  console.log(`[publish] Site URL: ${config.siteUrl}`);
  console.log(`[publish] Output directory: ${config.outputDir}`);
  console.log(`[publish] Published digest: ${nextItem.title}`);
  console.log(`[publish] Feed entries kept: ${mergedItems.length}`);
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[publish] Fatal error: ${message}`);
  process.exit(1);
});
