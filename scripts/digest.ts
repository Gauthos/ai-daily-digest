import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { formatHawaiiDate } from './types.js';
import type { Article, CategoryId, ClassifiedArticle, ScoredArticle } from './types.js';
import { RSS_FEEDS, fetchAllFeeds } from './feeds.js';
import { createAIClient, inferOpenAIModel } from './ai-client.js';
import {
  classifyArticlesWithAI,
  scoreArticlesWithAI,
  summarizeArticles,
  summarizeNewsArticles,
  generateHighlights,
} from './scoring.js';
import { generateDigestReport } from './report.js';
import { enrichArticlesWithFullText } from './fulltext.js';

const OPENAI_DEFAULT_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_HISTORY_DIR = 'content/posts';
const DEFAULT_SEARCH_INDEX = 'static/search-index.json';
const TOPIC_DEDUP_DAYS = 7;
const TOPIC_PENALTY_FACTOR = 0.4;
const MAX_FLASH_ITEMS = 10;
const PENDING_CLUSTER_RETENTION_DAYS = 8;

interface CandidateArticle extends ClassifiedArticle {
  originalIndex: number;
  totalScore: number;
  breakdown: {
    relevance: number;
    quality: number;
    timeliness: number;
    category: CategoryId;
    keywords: string[];
  };
}

interface PendingClusterArticle {
  title: string;
  link: string;
  summary: string;
  source: string;
  pubDate: string;
}

interface PendingCluster {
  first_seen: string;
  articles: PendingClusterArticle[];
  status: 'ongoing';
}

type NewsRepresentative = ClassifiedArticle & Pick<ScoredArticle, 'relatedArticles'>;

function printUsage(): never {
  console.log(`AI Daily Digest - AI-powered RSS digest from 90+ top tech blogs

Usage:
  bun scripts/digest.ts [options]

Options:
  --hours <n>     Time range in hours (default: 48)
  --top-n <n>     Number of top articles to include (default: 15)
  --lang <lang>   Summary language: zh or en (default: zh)
  --output <path> Output file path (default: ./digest-YYYYMMDD.md)
  --history-dir <path> Directory containing previously published posts (default: content/posts)
  --search-index <path> Path to search-index.json for topic dedup (default: static/search-index.json)
  --help          Show this help

Environment:
  GEMINI_API_KEY   Optional but recommended. Get one at https://aistudio.google.com/apikey
  OPENAI_API_KEY   Optional fallback key for OpenAI-compatible APIs
  OPENAI_API_BASE  Optional fallback base URL (default: https://api.openai.com/v1)
  OPENAI_MODEL     Optional fallback model (default: deepseek-v4-pro for DeepSeek base, else gpt-4o-mini)

Examples:
  bun scripts/digest.ts --hours 24 --top-n 10 --lang zh
  bun scripts/digest.ts --hours 72 --top-n 20 --lang en --output ./my-digest.md
`);
  process.exit(0);
}

interface SearchIndexEntry {
  date: string;
  title: string;
  source: string;
  link: string;
}

function normalizeTitleForDedup(title: string): string {
  return title.toLowerCase()
    .replace(/\s*\[ad\s*free\]\s*/g, '')
    .replace(/\s*\(free\)\s*/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleJaccard(a: string, b: string): number {
  const wordsA = new Set(normalizeTitleForDedup(a).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalizeTitleForDedup(b).split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

async function loadSearchIndex(indexPath: string, beforeDate: string, days: number): Promise<SearchIndexEntry[]> {
  try {
    const raw = await readFile(indexPath, 'utf8');
    const entries = JSON.parse(raw) as SearchIndexEntry[];
    const cutoff = new Date(beforeDate);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return entries.filter(e => e.date >= cutoffStr && e.date < beforeDate);
  } catch {
    return [];
  }
}

function normalizeArticleLink(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    url.hash = '';
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');
    return `${host}${path}${url.search}`.toLowerCase();
  } catch {
    return trimmed
      .replace(/#.*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, '');
  }
}

function extractMarkdownArticleLinks(markdown: string): string[] {
  const links: string[] = [];
  const linkRe = /^\[[^\]]+\]\((https?:\/\/[^)\s]+)\)\s+—\s+\*\*/gm;

  for (const match of markdown.matchAll(linkRe)) {
    links.push(match[1]!);
  }

  return links;
}

async function loadPostLinks(postDir: string): Promise<string[]> {
  try {
    const raw = await readFile(join(postDir, 'feed-source.json'), 'utf8');
    const parsed = JSON.parse(raw) as { selected?: Array<{ link?: unknown }> };
    const links = (parsed.selected || [])
      .map(item => typeof item.link === 'string' ? item.link : '')
      .filter(Boolean);
    if (links.length > 0) return links;
  } catch {
    // Older posts may not have feed-source.json; fall back to the rendered Markdown.
  }

  try {
    const markdown = await readFile(join(postDir, 'index.md'), 'utf8');
    return extractMarkdownArticleLinks(markdown);
  } catch {
    return [];
  }
}

async function loadHistoricalArticleKeys(historyDir: string, beforeDate: string): Promise<Set<string>> {
  let entries: string[];
  try {
    entries = await readdir(historyDir);
  } catch {
    return new Set();
  }

  const keys = new Set<string>();
  const postDates = entries
    .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name) && name < beforeDate)
    .sort();

  for (const date of postDates) {
    const links = await loadPostLinks(join(historyDir, date));
    for (const link of links) {
      const key = normalizeArticleLink(link);
      if (key) keys.add(key);
    }
  }

  return keys;
}

function mergeKeywords(primary: string[], fallback: string[]): string[] {
  const result: string[] = [];
  for (const keyword of [...primary, ...fallback]) {
    const trimmed = keyword.trim();
    if (!trimmed) continue;
    if (result.some(existing => existing.toLowerCase() === trimmed.toLowerCase())) continue;
    result.push(trimmed);
    if (result.length >= 5) break;
  }
  return result;
}

function clusterKey(article: ClassifiedArticle): string {
  return article.eventCluster || `${article.sourceName}::${normalizeTitleForDedup(article.title)}`;
}

function withHistoricalTopicPenalties(
  articles: CandidateArticle[],
  publishedIndex: SearchIndexEntry[],
): number {
  let topicPenaltyCount = 0;
  if (publishedIndex.length === 0) return 0;

  const publishedTitleKeys = new Set<string>();
  const publishedEntries: Array<{ source: string; normalized: string }> = [];
  for (const entry of publishedIndex) {
    const key = `${entry.source}::${normalizeTitleForDedup(entry.title)}`;
    publishedTitleKeys.add(key);
    publishedEntries.push({ source: entry.source, normalized: normalizeTitleForDedup(entry.title) });
  }

  for (const article of articles) {
    const titleKey = `${article.sourceName}::${normalizeTitleForDedup(article.title)}`;
    if (publishedTitleKeys.has(titleKey)) {
      article.totalScore = Math.round(article.totalScore * TOPIC_PENALTY_FACTOR);
      topicPenaltyCount++;
      continue;
    }

    const normalizedTitle = normalizeTitleForDedup(article.title);
    const hasSimilar = publishedEntries.some(
      e => e.source === article.sourceName && titleJaccard(normalizedTitle, e.normalized) > 0.7
    );
    if (hasSimilar) {
      article.totalScore = Math.round(article.totalScore * TOPIC_PENALTY_FACTOR);
      topicPenaltyCount++;
    }
  }

  return topicPenaltyCount;
}

function dedupeBySourceTitle<T extends Article>(articles: T[]): T[] {
  const seenTitleKeys = new Set<string>();
  return articles.filter(a => {
    const key = `${a.sourceName}::${normalizeTitleForDedup(a.title)}`;
    if (seenTitleKeys.has(key)) return false;
    seenTitleKeys.add(key);
    return true;
  });
}

function selectNewsRepresentatives(newsArticles: ClassifiedArticle[]): NewsRepresentative[] {
  const byCluster = new Map<string, ClassifiedArticle[]>();
  for (const article of newsArticles) {
    const key = clusterKey(article);
    const group = byCluster.get(key) || [];
    group.push(article);
    byCluster.set(key, group);
  }

  const representatives: NewsRepresentative[] = [];
  for (const group of byCluster.values()) {
    group.sort((a, b) => {
      const duplicateDelta = Number(a.isDuplicateOfEvent) - Number(b.isDuplicateOfEvent);
      if (duplicateDelta !== 0) return duplicateDelta;
      return b.pubDate.getTime() - a.pubDate.getTime();
    });
    const representative = group[0]!;
    representatives.push({
      ...representative,
      relatedArticles: group.slice(1).map(a => ({
        title: a.title,
        link: a.link,
        sourceName: a.sourceName,
        pubDate: a.pubDate,
      })),
    });
  }

  representatives.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  return representatives;
}

function buildPendingClusters(articles: ScoredArticle[], digestDate: string): Record<string, PendingCluster> {
  const clusters: Record<string, PendingCluster> = {};

  for (const article of articles) {
    if (!article.eventCluster) continue;
    const cluster = clusters[article.eventCluster] || {
      first_seen: digestDate,
      articles: [],
      status: 'ongoing' as const,
    };

    cluster.articles.push({
      title: article.title,
      link: article.link,
      summary: article.summary,
      source: article.sourceName,
      pubDate: article.pubDate.toISOString(),
    });

    for (const related of article.relatedArticles || []) {
      cluster.articles.push({
        title: related.title,
        link: related.link,
        summary: '',
        source: related.sourceName,
        pubDate: related.pubDate.toISOString(),
      });
    }

    clusters[article.eventCluster] = cluster;
  }

  return clusters;
}

function parseDateOnly(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dedupePendingArticles(articles: PendingClusterArticle[]): PendingClusterArticle[] {
  const seen = new Set<string>();
  const result: PendingClusterArticle[] = [];

  for (const article of articles) {
    const key = normalizeArticleLink(article.link) || `${article.source}::${normalizeTitleForDedup(article.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  result.sort((a, b) => b.pubDate.localeCompare(a.pubDate));
  return result;
}

function isPendingClusterRecord(value: unknown): value is Record<string, PendingCluster> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function loadPendingClusters(path: string): Promise<Record<string, PendingCluster>> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isPendingClusterRecord(parsed)) return {};

    const clusters: Record<string, PendingCluster> = {};
    for (const [label, cluster] of Object.entries(parsed)) {
      if (!cluster || typeof cluster !== 'object' || !Array.isArray((cluster as PendingCluster).articles)) continue;
      const firstSeen = typeof (cluster as PendingCluster).first_seen === 'string'
        ? (cluster as PendingCluster).first_seen
        : '';
      if (!parseDateOnly(firstSeen)) continue;

      clusters[label] = {
        first_seen: firstSeen,
        status: 'ongoing',
        articles: (cluster as PendingCluster).articles.filter(article =>
          article &&
          typeof article.title === 'string' &&
          typeof article.link === 'string' &&
          typeof article.source === 'string' &&
          typeof article.pubDate === 'string'
        ),
      };
    }

    return clusters;
  } catch {
    return {};
  }
}

function mergePendingClusters(
  existing: Record<string, PendingCluster>,
  incoming: Record<string, PendingCluster>,
  digestDate: string,
): Record<string, PendingCluster> {
  const digestDay = parseDateOnly(digestDate);
  const cutoff = digestDay ? new Date(digestDay) : null;
  if (cutoff) cutoff.setDate(cutoff.getDate() - PENDING_CLUSTER_RETENTION_DAYS);

  const merged: Record<string, PendingCluster> = {};
  for (const [label, cluster] of Object.entries(existing)) {
    const firstSeen = parseDateOnly(cluster.first_seen);
    if (cutoff && firstSeen && firstSeen < cutoff) continue;
    merged[label] = {
      first_seen: cluster.first_seen,
      status: 'ongoing',
      articles: dedupePendingArticles(cluster.articles),
    };
  }

  for (const [label, cluster] of Object.entries(incoming)) {
    const previous = merged[label];
    if (!previous) {
      merged[label] = {
        first_seen: cluster.first_seen,
        status: 'ongoing',
        articles: dedupePendingArticles(cluster.articles),
      };
      continue;
    }

    const previousFirstSeen = parseDateOnly(previous.first_seen);
    const incomingFirstSeen = parseDateOnly(cluster.first_seen);
    merged[label] = {
      first_seen: previousFirstSeen && incomingFirstSeen && incomingFirstSeen < previousFirstSeen
        ? cluster.first_seen
        : previous.first_seen,
      status: 'ongoing',
      articles: dedupePendingArticles([...previous.articles, ...cluster.articles]),
    };
  }

  return merged;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  let hours = 48;
  let topN = 15;
  let lang: 'zh' | 'en' = 'zh';
  let outputPath = '';
  let historyDir = DEFAULT_HISTORY_DIR;
  let searchIndexPath = DEFAULT_SEARCH_INDEX;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--hours' && args[i + 1]) {
      hours = parseInt(args[++i]!, 10);
    } else if (arg === '--top-n' && args[i + 1]) {
      topN = parseInt(args[++i]!, 10);
    } else if (arg === '--lang' && args[i + 1]) {
      const langArg = args[++i]!;
      if (langArg !== 'zh' && langArg !== 'en') {
        console.error(`[digest] Error: Invalid --lang value "${langArg}". Must be "zh" or "en".`);
        process.exit(1);
      }
      lang = langArg;
    } else if (arg === '--output' && args[i + 1]) {
      outputPath = args[++i]!;
    } else if (arg === '--history-dir' && args[i + 1]) {
      historyDir = args[++i]!;
    } else if (arg === '--search-index' && args[i + 1]) {
      searchIndexPath = args[++i]!;
    }
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiApiBase = process.env.OPENAI_API_BASE;
  const openaiModel = process.env.OPENAI_MODEL;

  if (!geminiApiKey && !openaiApiKey) {
    console.error('[digest] Error: Missing API key. Set GEMINI_API_KEY and/or OPENAI_API_KEY.');
    console.error('[digest] Gemini key: https://aistudio.google.com/apikey');
    process.exit(1);
  }

  const aiClient = createAIClient({
    geminiApiKey,
    openaiApiKey,
    openaiApiBase,
    openaiModel,
  });

  const digestDate = formatHawaiiDate(new Date());

  if (!outputPath) {
    const dateStr = digestDate.replace(/-/g, '');
    outputPath = `./digest-${dateStr}.md`;
  }

  console.log(`[digest] === AI Daily Digest ===`);
  console.log(`[digest] Time range: ${hours} hours`);
  console.log(`[digest] Top N: ${topN}`);
  console.log(`[digest] Language: ${lang}`);
  console.log(`[digest] Output: ${outputPath}`);
  console.log(`[digest] History dedupe: ${historyDir} before ${digestDate}`);
  console.log(`[digest] AI provider: ${geminiApiKey ? 'Gemini (primary)' : 'OpenAI-compatible (primary)'}`);
  if (openaiApiKey) {
    const resolvedBase = (openaiApiBase?.trim() || OPENAI_DEFAULT_API_BASE).replace(/\/+$/, '');
    const resolvedModel = openaiModel?.trim() || inferOpenAIModel(resolvedBase);
    console.log(`[digest] Fallback: ${resolvedBase} (model=${resolvedModel})`);
  }
  console.log('');

  console.log(`[digest] Step 1/6: Fetching ${RSS_FEEDS.length} RSS feeds...`);
  const fetchResult = await fetchAllFeeds(RSS_FEEDS);
  const allArticles = fetchResult.articles;

  if (allArticles.length === 0) {
    console.error('[digest] Error: No articles fetched from any feed. Check network connection.');
    process.exit(1);
  }

  console.log(`[digest] Step 2/6: Filtering by time range (${hours} hours)...`);
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  const recentArticles = allArticles.filter(a => a.pubDate.getTime() > cutoffTime.getTime());
  const historicalArticleKeys = await loadHistoricalArticleKeys(historyDir, digestDate);
  if (historicalArticleKeys.size > 0) {
    console.log(`[digest] Loaded ${historicalArticleKeys.size} previously published article links`);
  }

  const seenUrls = new Set<string>();
  let previousPublishCount = 0;
  const uniqueArticles = recentArticles.filter(a => {
    const normalized = normalizeArticleLink(a.link);
    if (seenUrls.has(normalized)) return false;
    seenUrls.add(normalized);
    if (historicalArticleKeys.has(normalized)) {
      previousPublishCount++;
      return false;
    }
    return true;
  });
  const dupeCount = recentArticles.length - uniqueArticles.length;
  if (dupeCount > 0) {
    console.log(`[digest] Removed ${dupeCount} duplicate articles (${previousPublishCount} previously published)`);
  }

  console.log(`[digest] Found ${uniqueArticles.length} unique articles within last ${hours} hours`);

  if (uniqueArticles.length === 0) {
    console.error(`[digest] Error: No articles found within the last ${hours} hours.`);
    console.error(`[digest] Try increasing --hours (e.g., --hours 168 for one week)`);
    process.exit(1);
  }

  console.log(`[digest] Step 3/6: Classifying content_type for ${uniqueArticles.length} articles...`);
  const classificationResult = await classifyArticlesWithAI(uniqueArticles, aiClient);
  const classifications = classificationResult.values;

  if (uniqueArticles.length > 0 && classificationResult.totalBatches > 0 && classificationResult.failedBatches === classificationResult.totalBatches) {
    console.error('[digest] Error: AI classification failed for every batch. Check Actions secrets and provider settings.');
    console.error('[digest] Expected at least one successful content_type batch, but all requests fell back to default analysis classification.');
    process.exit(1);
  }

  const classifiedArticles: ClassifiedArticle[] = uniqueArticles.map((article, index) => {
    const classification = classifications.get(index) || {
      contentType: 'analysis' as const,
      eventCluster: null,
      isDuplicateOfEvent: false,
      category: 'other' as CategoryId,
      keywords: [],
    };
    return {
      ...article,
      contentType: classification.contentType,
      eventCluster: classification.eventCluster,
      isDuplicateOfEvent: classification.isDuplicateOfEvent,
      category: classification.category,
      keywords: classification.keywords,
    };
  });

  const analysisArticles = classifiedArticles.filter(a => a.contentType === 'analysis');
  const newsArticles = classifiedArticles.filter(a => a.contentType === 'news');
  console.log(`[digest] Content split: ${analysisArticles.length} analysis, ${newsArticles.length} news`);

  console.log(`[digest] Step 4/6: AI scoring ${analysisArticles.length} analysis articles...`);
  const scoringResult = await scoreArticlesWithAI(analysisArticles, aiClient);
  const scores = scoringResult.values;

  if (analysisArticles.length > 0 && scoringResult.totalBatches > 0 && scoringResult.failedBatches === scoringResult.totalBatches) {
    console.error('[digest] Error: AI scoring failed for every analysis batch. Check Actions secrets and provider settings.');
    console.error('[digest] Expected at least one successful scoring batch, but all requests fell back to default scores.');
    process.exit(1);
  }

  const scoredAnalysisArticles: CandidateArticle[] = analysisArticles.map((article, index) => {
    const score = scores.get(index) || {
      relevance: 1,
      quality: 1,
      timeliness: 1,
      category: article.category,
      keywords: [],
    };
    const category = score.category === 'other' ? article.category : score.category;
    const keywords = mergeKeywords(score.keywords, article.keywords);
    return {
      ...article,
      originalIndex: index,
      totalScore: score.relevance + score.quality + score.timeliness,
      breakdown: {
        relevance: score.relevance,
        quality: score.quality,
        timeliness: score.timeliness,
        category,
        keywords,
      },
    };
  });

  const publishedIndex = await loadSearchIndex(searchIndexPath, digestDate, TOPIC_DEDUP_DAYS);
  const topicPenaltyCount = withHistoricalTopicPenalties(scoredAnalysisArticles, publishedIndex);
  if (topicPenaltyCount > 0) {
    console.log(`[digest] Topic dedup: penalized ${topicPenaltyCount} analysis articles similar to recently published`);
  }

  const batchDedupedArticles = dedupeBySourceTitle(scoredAnalysisArticles);
  const batchDupes = scoredAnalysisArticles.length - batchDedupedArticles.length;
  if (batchDupes > 0) {
    console.log(`[digest] Intra-batch title dedup: removed ${batchDupes} analysis duplicates`);
  }

  batchDedupedArticles.sort((a, b) => b.totalScore - a.totalScore);
  const topArticles = batchDedupedArticles.slice(0, topN);

  console.log(`[digest] Top ${topArticles.length} analysis articles selected (score range: ${topArticles[topArticles.length - 1]?.totalScore || 0} - ${topArticles[0]?.totalScore || 0})`);

  console.log(`[digest] Step 5/6: Fetching full text and generating AI summaries / flash news...`);
  const fullTextResult = await enrichArticlesWithFullText(topArticles);
  console.log(`[digest] Full text: ${fullTextResult.fetched}/${topArticles.length} analysis articles fetched (${fullTextResult.failed} fallback to RSS descriptions)`);
  const summaryInputArticles = fullTextResult.articles;
  const indexedTopArticles = summaryInputArticles.map((a, i) => ({ ...a, index: i }));
  const summaryResult = await summarizeArticles(indexedTopArticles, aiClient, lang);
  const summaries = summaryResult.values;

  if (topArticles.length > 0 && summaryResult.totalBatches > 0 && summaryResult.failedBatches === summaryResult.totalBatches) {
    console.error('[digest] Error: AI summarization failed for every analysis batch. Check Actions secrets and provider settings.');
    console.error('[digest] Expected at least one successful summary batch, but all requests fell back to raw titles.');
    process.exit(1);
  }

  const finalAnalysisArticles: ScoredArticle[] = summaryInputArticles.map((a, i) => {
    const sm = summaries.get(i) || { titleZh: a.title, summary: a.description.slice(0, 200), editorial: '' };
    return {
      title: a.title,
      link: a.link,
      pubDate: a.pubDate,
      description: a.description,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
      contentType: 'analysis',
      eventCluster: null,
      score: a.totalScore,
      scoreBreakdown: {
        relevance: a.breakdown.relevance,
        quality: a.breakdown.quality,
        timeliness: a.breakdown.timeliness,
      },
      category: a.breakdown.category,
      keywords: a.breakdown.keywords,
      titleZh: sm.titleZh,
      summary: sm.summary,
      editorial: sm.editorial,
    };
  });

  const allNewsRepresentatives = selectNewsRepresentatives(newsArticles);
  const newsRepresentatives = allNewsRepresentatives.slice(0, MAX_FLASH_ITEMS);
  const indexedNewsArticles = newsRepresentatives.map((a, i) => ({ ...a, index: i }));
  const newsSummaryResult = await summarizeNewsArticles(indexedNewsArticles, aiClient, lang);
  const newsSummaries = newsSummaryResult.values;

  const finalNewsArticles: ScoredArticle[] = newsRepresentatives.map((a, i) => {
    const sm = newsSummaries.get(i) || { titleZh: a.title, summary: a.description.slice(0, 120) || a.title };
    return {
      title: a.title,
      link: a.link,
      pubDate: a.pubDate,
      description: a.description,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
      contentType: 'news',
      eventCluster: a.eventCluster,
      relatedArticles: a.relatedArticles,
      score: 0,
      scoreBreakdown: {
        relevance: 0,
        quality: 0,
        timeliness: 0,
      },
      category: a.category,
      keywords: a.keywords,
      titleZh: sm.titleZh,
      summary: sm.summary,
      editorial: '',
    };
  });

  const pendingNewsArticles: ScoredArticle[] = allNewsRepresentatives.map((a) => {
    const displayed = finalNewsArticles.find(article => normalizeArticleLink(article.link) === normalizeArticleLink(a.link));
    return displayed || {
      title: a.title,
      link: a.link,
      pubDate: a.pubDate,
      description: a.description,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
      contentType: 'news',
      eventCluster: a.eventCluster,
      relatedArticles: a.relatedArticles,
      score: 0,
      scoreBreakdown: {
        relevance: 0,
        quality: 0,
        timeliness: 0,
      },
      category: a.category,
      keywords: a.keywords,
      titleZh: a.title,
      summary: a.description.slice(0, 120) || a.title,
      editorial: '',
    };
  });

  const finalArticles = [...finalAnalysisArticles, ...finalNewsArticles];

  console.log(`[digest] Step 6/6: Generating today's highlights...`);
  const highlights = await generateHighlights(finalArticles, aiClient, lang);

  const successfulSources = new Set(allArticles.map(a => a.sourceName));

  const report = generateDigestReport(finalArticles, highlights, {
    totalFeeds: RSS_FEEDS.length,
    successFeeds: successfulSources.size,
    totalArticles: allArticles.length,
    filteredArticles: uniqueArticles.length,
    hours,
    lang,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, report);

  const articlesIndex = finalArticles.map(a => ({
    date: digestDate,
    pubDate: a.pubDate.toISOString(),
    title: a.title,
    titleZh: a.titleZh,
    link: a.link,
    source: a.sourceName,
    sourceUrl: a.sourceUrl,
    contentType: a.contentType,
    eventCluster: a.eventCluster,
    category: a.category,
    tags: a.keywords,
    score: a.score,
    scoreBreakdown: a.scoreBreakdown,
    summary: a.summary,
    description: a.description.slice(0, 500),
    editorial: a.editorial,
    relatedArticles: (a.relatedArticles || []).map(related => ({
      title: related.title,
      link: related.link,
      source: related.sourceName,
      pubDate: related.pubDate.toISOString(),
    })),
  }));
  const articlesPath = outputPath.replace(/\.md$/, '.articles.json');
  await writeFile(articlesPath, JSON.stringify(articlesIndex, null, 2) + '\n');

  const finalByLink = new Map(finalArticles.map(article => [normalizeArticleLink(article.link), article]));
  const searchIndexArticles = classifiedArticles.map(article => {
    const final = finalByLink.get(normalizeArticleLink(article.link));
    return {
      date: digestDate,
      pubDate: article.pubDate.toISOString(),
      title: article.title,
      titleZh: final?.titleZh || '',
      link: article.link,
      source: article.sourceName,
      sourceUrl: article.sourceUrl,
      contentType: article.contentType,
      eventCluster: article.eventCluster,
      category: final?.category || article.category,
      tags: final?.keywords || article.keywords,
      summary: final?.summary || '',
      description: article.description.slice(0, 500),
      editorial: final?.editorial || '',
      selected: Boolean(final),
    };
  });
  const searchIndexArticlesPath = outputPath.replace(/\.md$/, '.search-index.json');
  await writeFile(searchIndexArticlesPath, JSON.stringify(searchIndexArticles, null, 2) + '\n');

  const buildDir = dirname(outputPath);

  const pendingClustersPath = `${buildDir}/pending-clusters.json`;
  const existingPendingClusters = await loadPendingClusters(pendingClustersPath);
  const pendingClusters = mergePendingClusters(
    existingPendingClusters,
    buildPendingClusters(pendingNewsArticles, digestDate),
    digestDate,
  );
  await writeFile(pendingClustersPath, JSON.stringify(pendingClusters, null, 2) + '\n');
  console.log(`[digest] 📋 Pending clusters: ${pendingClustersPath}`);

  const healthPath = `${buildDir}/feed-health.json`;
  const healthReport = {
    date: digestDate,
    totalFeeds: RSS_FEEDS.length,
    ok: fetchResult.health.filter(h => h.status === 'ok').length,
    empty: fetchResult.health.filter(h => h.status === 'empty').length,
    failed: fetchResult.health.filter(h => h.status === 'failed').length,
    feeds: fetchResult.health,
  };
  await writeFile(healthPath, JSON.stringify(healthReport, null, 2) + '\n');
  console.log(`[digest] 📋 Feed health: ${healthPath}`);

  const sourcePath = `${buildDir}/feed-source.json`;
  const sourceReport = {
    date: digestDate,
    hours,
    topN,
    lang,
    totalCandidates: uniqueArticles.length,
    excludedPreviouslyPublished: previousPublishCount,
    contentSplit: {
      news: newsArticles.length,
      analysis: analysisArticles.length,
    },
    selected: finalArticles.map((a, i) => ({
      rank: i + 1,
      title: a.title,
      titleZh: a.titleZh,
      link: a.link,
      source: a.sourceName,
      sourceUrl: a.sourceUrl,
      contentType: a.contentType,
      eventCluster: a.eventCluster,
      category: a.category,
      score: a.score,
      scoreBreakdown: a.scoreBreakdown,
      pubDate: a.pubDate.toISOString(),
      keywords: a.keywords,
      relatedArticles: (a.relatedArticles || []).map(related => ({
        title: related.title,
        link: related.link,
        source: related.sourceName,
        pubDate: related.pubDate.toISOString(),
      })),
    })),
  };
  await writeFile(sourcePath, JSON.stringify(sourceReport, null, 2) + '\n');
  console.log(`[digest] 📋 Feed source: ${sourcePath}`);

  console.log('');
  console.log(`[digest] ✅ Done!`);
  console.log(`[digest] 📁 Report: ${outputPath}`);
  console.log(`[digest] 📊 Stats: ${successfulSources.size} sources → ${allArticles.length} articles → ${uniqueArticles.length} recent → ${finalAnalysisArticles.length} deep reads + ${finalNewsArticles.length} flash news`);

  if (finalAnalysisArticles.length > 0) {
    console.log('');
    console.log(`[digest] 🏆 Top 3 Preview:`);
    for (let i = 0; i < Math.min(3, finalAnalysisArticles.length); i++) {
      const a = finalAnalysisArticles[i];
      console.log(`  ${i + 1}. ${a.titleZh || a.title}`);
      console.log(`     ${a.summary.slice(0, 80)}...`);
    }
  }
}

if (import.meta.main) {
  await main().catch((err) => {
    console.error(`[digest] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
