import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';

import { callJsonWithRetry, createAIClient, inferOpenAIModel } from './ai-client.js';
import type {
  AIClient,
  BatchResultMap,
  CategoryId,
  ContentType,
  WeeklyDepthLabel,
  WeeklyEvaluationScores,
} from './types.js';

const OPENAI_DEFAULT_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_INPUT = 'static/search-index.json';
const DEFAULT_OUTPUT = '.build/weekly-evaluation.json';
const DEFAULT_DAYS = 7;
const WEEKLY_BATCH_SIZE = 10;
const MAX_CONCURRENT_BATCHES = 2;
const OPENAI_REASONING_TOKENS_BASE = 256;
const OPENAI_REASONING_TOKENS_PER_ITEM = 180;

const VALID_WEEKLY_LABELS = new Set<WeeklyDepthLabel>([
  'Flash',
  'Signal',
  'Analysis',
  'Thesis',
  'Canon',
]);

interface SearchIndexArticle {
  date?: string;
  pubDate?: string;
  title?: string;
  titleZh?: string;
  link?: string;
  source?: string;
  sourceUrl?: string;
  contentType?: ContentType | string;
  eventCluster?: string | null;
  category?: CategoryId | string;
  tags?: unknown;
  keywords?: unknown;
  summary?: string;
  description?: string;
  editorial?: string;
  selected?: boolean;
}

interface WeeklyArticle {
  index: number;
  date: string;
  pubDate: string;
  title: string;
  titleZh: string;
  link: string;
  source: string;
  sourceUrl: string;
  contentType: ContentType;
  eventCluster: string | null;
  category: CategoryId;
  tags: string[];
  summary: string;
  description: string;
  editorial: string;
  selected: boolean;
}

interface WeeklyEvaluationResult {
  index: number;
  depth_label?: string;
  weeklyDepthLabel?: string;
  half_life_score?: number;
  halfLifeScore?: number;
  horizon_score?: number;
  horizonScore?: number;
  signal_density?: number;
  signalDensity?: number;
  durability?: number;
  macro_impact?: number;
  macroImpact?: number;
  rationale?: string;
  follow_up_tags?: string[];
  followUpTags?: string[];
}

interface GeminiWeeklyEvaluationResult {
  results: WeeklyEvaluationResult[];
}

interface FinalWeeklyEvaluationArticle extends Omit<WeeklyArticle, 'index'> {
  weeklyDepthLabel: WeeklyDepthLabel;
  scores: WeeklyEvaluationScores;
  compositeScore: number;
  rationale: string;
  followUpTags: string[];
}

function printUsage(): never {
  console.log(`AI Daily Digest - weekly information-depth evaluation

Usage:
  bun scripts/weekly-evaluation.ts [options]

Options:
  --input <path>   search-index.json path (default: static/search-index.json)
  --output <path>  Output JSON path (default: .build/weekly-evaluation.json)
  --days <n>       Number of days before --date to evaluate (default: 7)
  --date <yyyy-mm-dd>
                   Evaluation date; the window is [date-days, date), UTC date by default
  --help           Show this help

Environment:
  GEMINI_API_KEY   Gemini API key (preferred)
  OPENAI_API_KEY   OpenAI-compatible API key (fallback or primary)
  OPENAI_API_BASE  OpenAI-compatible base URL
  OPENAI_MODEL     OpenAI-compatible model name
`);
  process.exit(0);
}

function parseArgs(argv: string[]): { inputPath: string; outputPath: string; days: number; evaluationDate: string } {
  let inputPath = DEFAULT_INPUT;
  let outputPath = DEFAULT_OUTPUT;
  let days = DEFAULT_DAYS;
  let evaluationDate = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') printUsage();
    if (arg === '--input' && argv[i + 1]) inputPath = argv[++i]!;
    else if (arg === '--output' && argv[i + 1]) outputPath = argv[++i]!;
    else if (arg === '--days' && argv[i + 1]) {
      const parsed = Number(argv[++i]);
      if (Number.isFinite(parsed) && parsed > 0) days = Math.floor(parsed);
    } else if (arg === '--date' && argv[i + 1]) {
      evaluationDate = argv[++i]!;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(evaluationDate)) {
    throw new Error(`Invalid --date value: ${evaluationDate}`);
  }

  return { inputPath, outputPath, days, evaluationDate };
}

function parseDateOnly(value: string): Date {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed;
}

function addDays(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLink(link: string): string {
  try {
    const url = new URL(link);
    url.hash = '';
    return `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`.toLowerCase();
  } catch {
    return link.replace(/#.*$/, '').replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
  }
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const result: string[] = [];
  for (const tag of tags) {
    const value = asString(tag);
    if (!value) continue;
    if (result.some(existing => existing.toLowerCase() === value.toLowerCase())) continue;
    result.push(value);
    if (result.length >= 8) break;
  }
  return result;
}

function normalizeContentType(value: unknown): ContentType {
  return value === 'news' ? 'news' : 'analysis';
}

function normalizeCategory(value: unknown): CategoryId {
  const category = asString(value);
  return ['ai-ml', 'security', 'engineering', 'tools', 'opinion', 'other'].includes(category)
    ? category as CategoryId
    : 'other';
}

function normalizeWeeklyLabel(value: unknown, article: WeeklyArticle): WeeklyDepthLabel {
  const label = asString(value).toLowerCase();
  const exact = Array.from(VALID_WEEKLY_LABELS).find(item => item.toLowerCase() === label);
  if (exact) return exact;
  if (article.contentType === 'news') return 'Flash';
  return 'Analysis';
}

function clampScore(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(10, Math.max(1, Math.round(value)));
}

function fallbackScores(label: WeeklyDepthLabel): WeeklyEvaluationScores {
  if (label === 'Flash') return { halfLifeScore: 2, horizonScore: 2, signalDensity: 5, durability: 2, macroImpact: 3 };
  if (label === 'Signal') return { halfLifeScore: 5, horizonScore: 5, signalDensity: 6, durability: 4, macroImpact: 5 };
  if (label === 'Thesis') return { halfLifeScore: 8, horizonScore: 8, signalDensity: 7, durability: 8, macroImpact: 7 };
  if (label === 'Canon') return { halfLifeScore: 10, horizonScore: 9, signalDensity: 8, durability: 10, macroImpact: 6 };
  return { halfLifeScore: 6, horizonScore: 6, signalDensity: 7, durability: 6, macroImpact: 5 };
}

function compositeScore(scores: WeeklyEvaluationScores): number {
  const weighted =
    scores.halfLifeScore * 1.15 +
    scores.horizonScore * 1.1 +
    scores.signalDensity +
    scores.durability * 1.15 +
    scores.macroImpact;
  return Math.round((weighted / 5.4) * 10) / 10;
}

function articleOutputFields(article: WeeklyArticle): Omit<WeeklyArticle, 'index'> {
  return {
    date: article.date,
    pubDate: article.pubDate,
    title: article.title,
    titleZh: article.titleZh,
    link: article.link,
    source: article.source,
    sourceUrl: article.sourceUrl,
    contentType: article.contentType,
    eventCluster: article.eventCluster,
    category: article.category,
    tags: article.tags,
    summary: article.summary,
    description: article.description,
    editorial: article.editorial,
    selected: article.selected,
  };
}

function fallbackEvaluation(article: WeeklyArticle): FinalWeeklyEvaluationArticle {
  const weeklyDepthLabel = article.contentType === 'news' ? 'Flash' : 'Analysis';
  const scores = fallbackScores(weeklyDepthLabel);
  return {
    ...articleOutputFields(article),
    weeklyDepthLabel,
    scores,
    compositeScore: compositeScore(scores),
    rationale: 'AI evaluation unavailable; defaulted from daily content_type.',
    followUpTags: article.tags.slice(0, 5),
  };
}

function normalizeEvaluation(article: WeeklyArticle, raw: WeeklyEvaluationResult): FinalWeeklyEvaluationArticle {
  const weeklyDepthLabel = normalizeWeeklyLabel(raw.depth_label ?? raw.weeklyDepthLabel, article);
  const fallback = fallbackScores(weeklyDepthLabel);
  const scores = {
    halfLifeScore: clampScore(raw.half_life_score ?? raw.halfLifeScore, fallback.halfLifeScore),
    horizonScore: clampScore(raw.horizon_score ?? raw.horizonScore, fallback.horizonScore),
    signalDensity: clampScore(raw.signal_density ?? raw.signalDensity, fallback.signalDensity),
    durability: clampScore(raw.durability, fallback.durability),
    macroImpact: clampScore(raw.macro_impact ?? raw.macroImpact, fallback.macroImpact),
  };
  const followUpTags = normalizeTags(raw.follow_up_tags ?? raw.followUpTags);

  return {
    ...articleOutputFields(article),
    weeklyDepthLabel,
    scores,
    compositeScore: compositeScore(scores),
    rationale: asString(raw.rationale) || 'No rationale returned.',
    followUpTags: followUpTags.length > 0 ? followUpTags : article.tags.slice(0, 5),
  };
}

function formatArticleForPrompt(article: WeeklyArticle): string {
  const parts = [
    `Index ${article.index}`,
    `date=${article.date}`,
    `source=${article.source}`,
    `daily_content_type=${article.contentType}`,
    `category=${article.category}`,
    `selected=${article.selected}`,
    article.eventCluster ? `event_cluster=${article.eventCluster}` : '',
    article.tags.length > 0 ? `tags=${article.tags.join(', ')}` : '',
    `title=${article.title}`,
    article.titleZh ? `titleZh=${article.titleZh}` : '',
    article.summary ? `summary=${article.summary}` : '',
    article.description ? `description=${article.description}` : '',
    article.editorial ? `editorial=${article.editorial}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}

function buildEvaluationPrompt(articles: WeeklyArticle[], topTags: string[]): string {
  const articleList = articles.map(formatArticleForPrompt).join('\n\n---\n\n');
  const tagContext = topTags.length > 0 ? topTags.join(', ') : '无';

  return `你是"蒲公英技术日报"的周度信息复盘编辑。请对上周文章做二次标注，用于周刊选题和长期价值筛选。

## 五类二次标签

- Flash: 短期事件，7 天内价值明显衰减
- Signal: 有持续观察价值的信息，可能提示趋势正在形成
- Analysis: 解释结构、趋势、因果，适合当周深读
- Thesis: 长期判断，可能影响数月到数年
- Canon: 长期值得保存、反复引用的内容，不依赖当周新闻语境

## 五个评分，全部为 1-10 整数

- half_life_score: 信息半衰期。1=数小时/数天失效，10=数月/数年仍有价值
- horizon_score: 影响时间跨度。1=只影响当天，10=可能影响数月到数年
- signal_density: 信息密度。1=低密度转述，10=高密度事实、框架或洞见
- durability: 长期有效性。1=很快过时，10=可长期引用
- macro_impact: 宏观影响力。1=局部工具/小变化，10=影响平台、产业、监管或技术路线

## 判断要求

- daily_content_type 只是日报路由，不要机械照抄；news 也可能升级为 Signal，analysis 也可能只是普通 Analysis
- Canon 必须非常克制，只给可复用框架、经典教程、基础研究、长期参考资料
- Thesis 必须包含明确长期判断或路线变化，不等于"写得好"
- Signal 关注连续性和后续观察价值，适合进入下周追踪
- rationale 用中文，1 句话，说明为什么是这个标签和分数
- follow_up_tags 给 3-5 个英文短 tag，用于下周追踪

本周高频 tag 参考：${tagContext}

## 待评估文章

${articleList}

请严格返回 JSON，必须为每个 Index 返回且只返回一条结果：
{
  "results": [
    {
      "index": 0,
      "depth_label": "Signal",
      "half_life_score": 6,
      "horizon_score": 7,
      "signal_density": 8,
      "durability": 5,
      "macro_impact": 6,
      "rationale": "这不是一次性新闻，而是某个技术方向连续升温的可观察信号。",
      "follow_up_tags": ["LLM", "inference", "platform"]
    }
  ]
}`;
}

function mapBatchResultsToArticleIndices<T extends { index: number }>(
  batch: WeeklyArticle[],
  results: T[] | undefined,
  taskLabel: string,
): Array<{ articleIndex: number; result: T }> {
  if (!Array.isArray(results)) throw new Error(`${taskLabel} returned no results array.`);
  if (results.length !== batch.length) {
    throw new Error(`${taskLabel} returned ${results.length} results for ${batch.length} requested articles.`);
  }

  const mapped: Array<{ articleIndex: number; result: T }> = [];
  const seen = new Set<number>();
  for (const result of results) {
    if (!Number.isInteger(result.index)) throw new Error(`${taskLabel} returned a non-integer batch index.`);
    if (result.index < 0 || result.index >= batch.length) throw new Error(`${taskLabel} returned out-of-range batch index ${result.index}.`);
    if (seen.has(result.index)) throw new Error(`${taskLabel} returned duplicate batch index ${result.index}.`);
    seen.add(result.index);
    mapped.push({ articleIndex: batch[result.index]!.index, result });
  }
  return mapped;
}

async function evaluateArticlesWithAI(
  articles: WeeklyArticle[],
  aiClient: AIClient,
  topTags: string[],
): Promise<BatchResultMap<FinalWeeklyEvaluationArticle>> {
  const evaluations = new Map<number, FinalWeeklyEvaluationArticle>();
  let failedBatches = 0;

  const batches: WeeklyArticle[][] = [];
  for (let i = 0; i < articles.length; i += WEEKLY_BATCH_SIZE) {
    batches.push(articles.slice(i, i + WEEKLY_BATCH_SIZE));
  }

  console.log(`[weekly-eval] AI evaluation: ${articles.length} articles in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    const group = batches.slice(i, i + MAX_CONCURRENT_BATCHES);
    const promises = group.map(async (batch) => {
      try {
        const promptBatch = batch.map((article, batchIndex) => ({ ...article, index: batchIndex }));
        const prompt = buildEvaluationPrompt(promptBatch, topTags);
        const parsed = await callJsonWithRetry<GeminiWeeklyEvaluationResult>(
          aiClient,
          prompt,
          'Weekly evaluation batch',
          { maxCompletionTokens: OPENAI_REASONING_TOKENS_BASE + batch.length * OPENAI_REASONING_TOKENS_PER_ITEM },
        );

        for (const { articleIndex, result } of mapBatchResultsToArticleIndices(batch, parsed.results, 'Weekly evaluation batch')) {
          evaluations.set(articleIndex, normalizeEvaluation(articles[articleIndex]!, result));
        }
      } catch (error) {
        failedBatches++;
        console.warn(`[weekly-eval] Evaluation batch failed: ${error instanceof Error ? error.message : String(error)}`);
        for (const article of batch) {
          evaluations.set(article.index, fallbackEvaluation(article));
        }
      }
    });

    await Promise.all(promises);
    console.log(`[weekly-eval] Evaluation progress: ${Math.min(i + MAX_CONCURRENT_BATCHES, batches.length)}/${batches.length} batches`);
  }

  return {
    values: evaluations,
    failedBatches,
    totalBatches: batches.length,
  };
}

function countTopTags(articles: WeeklyArticle[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const tag of article.tags) {
      const key = tag.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function normalizeArticles(entries: SearchIndexArticle[], startDate: string, endDate: string): WeeklyArticle[] {
  const seen = new Set<string>();
  const articles: WeeklyArticle[] = [];

  for (const entry of entries) {
    const link = asString(entry.link);
    const title = asString(entry.title);
    const date = asString(entry.date) || asString(entry.pubDate).slice(0, 10);
    if (!link || !title || !date) continue;
    if (date < startDate || date >= endDate) continue;

    const key = normalizeLink(link);
    if (seen.has(key)) continue;
    seen.add(key);

    articles.push({
      index: articles.length,
      date,
      pubDate: asString(entry.pubDate),
      title,
      titleZh: asString(entry.titleZh),
      link,
      source: asString(entry.source),
      sourceUrl: asString(entry.sourceUrl),
      contentType: normalizeContentType(entry.contentType),
      eventCluster: asString(entry.eventCluster) || null,
      category: normalizeCategory(entry.category),
      tags: normalizeTags(entry.tags ?? entry.keywords),
      summary: asString(entry.summary),
      description: asString(entry.description),
      editorial: asString(entry.editorial),
      selected: Boolean(entry.selected),
    });
  }

  return articles
    .sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source))
    .map((article, index) => ({ ...article, index }));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function buildSummary(articles: FinalWeeklyEvaluationArticle[]): Record<string, unknown> {
  const labels: Record<WeeklyDepthLabel, number> = {
    Flash: 0,
    Signal: 0,
    Analysis: 0,
    Thesis: 0,
    Canon: 0,
  };

  for (const article of articles) {
    labels[article.weeklyDepthLabel]++;
  }

  return {
    totalArticles: articles.length,
    labels,
    averageScores: {
      halfLifeScore: average(articles.map(a => a.scores.halfLifeScore)),
      horizonScore: average(articles.map(a => a.scores.horizonScore)),
      signalDensity: average(articles.map(a => a.scores.signalDensity)),
      durability: average(articles.map(a => a.scores.durability)),
      macroImpact: average(articles.map(a => a.scores.macroImpact)),
      compositeScore: average(articles.map(a => a.compositeScore)),
    },
    topFollowUpTags: countTopTags(articles.map((article, index) => ({
      ...article,
      index,
      tags: article.followUpTags,
    })), 20),
  };
}

async function main(): Promise<void> {
  const { inputPath, outputPath, days, evaluationDate } = parseArgs(process.argv.slice(2));
  const startDate = addDays(evaluationDate, -days);

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiApiBase = process.env.OPENAI_API_BASE;
  const openaiModel = process.env.OPENAI_MODEL || (openaiApiBase ? inferOpenAIModel(openaiApiBase) : undefined);

  console.log(`[weekly-eval] Input: ${inputPath}`);
  console.log(`[weekly-eval] Output: ${outputPath}`);
  console.log(`[weekly-eval] Window: ${startDate} <= article.date < ${evaluationDate}`);
  console.log(`[weekly-eval] AI provider: ${geminiApiKey ? 'Gemini (primary)' : 'OpenAI-compatible (primary)'}`);
  if (openaiApiKey) {
    const resolvedBase = (openaiApiBase?.trim() || OPENAI_DEFAULT_API_BASE).replace(/\/+$/, '');
    console.log(`[weekly-eval] OpenAI-compatible fallback: ${resolvedBase} (${openaiModel})`);
  }

  const raw = await readFile(inputPath, 'utf8');
  const parsed = JSON.parse(raw) as SearchIndexArticle[];
  if (!Array.isArray(parsed)) throw new Error(`${inputPath} must contain a JSON array.`);

  const articles = normalizeArticles(parsed, startDate, evaluationDate);
  const topTags = countTopTags(articles, 20);
  console.log(`[weekly-eval] Loaded ${articles.length} articles for evaluation (${parsed.length} index entries scanned)`);

  let finalArticles: FinalWeeklyEvaluationArticle[] = [];
  if (articles.length > 0) {
    const aiClient = createAIClient({ geminiApiKey, openaiApiKey, openaiApiBase, openaiModel });
    const result = await evaluateArticlesWithAI(articles, aiClient, topTags);

    if (result.totalBatches > 0 && result.failedBatches === result.totalBatches) {
      console.error('[weekly-eval] Error: AI weekly evaluation failed for every batch. Check Actions secrets and provider settings.');
      process.exit(1);
    }

    finalArticles = articles.map(article => result.values.get(article.index) || fallbackEvaluation(article));
  }

  finalArticles.sort((a, b) => b.compositeScore - a.compositeScore || b.date.localeCompare(a.date));

  const output = {
    schemaVersion: 1,
    evaluationDate,
    window: {
      startDate,
      endDate: evaluationDate,
      days,
    },
    labelDefinitions: {
      Flash: '短期事件，7 天内价值明显衰减',
      Signal: '有持续观察价值的信息',
      Analysis: '解释结构、趋势、因果',
      Thesis: '长期判断，可能影响数月到数年',
      Canon: '长期值得保存、反复引用的内容',
    },
    scoreDefinitions: {
      halfLifeScore: '信息半衰期',
      horizonScore: '影响时间跨度',
      signalDensity: '信息密度',
      durability: '长期有效性',
      macroImpact: '宏观影响力',
    },
    summary: buildSummary(finalArticles),
    articles: finalArticles,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`[weekly-eval] Done: ${outputPath}`);
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[weekly-eval] Fatal error: ${message}`);
  process.exit(1);
});
