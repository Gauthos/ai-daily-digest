import { callJsonWithRetry } from './ai-client.js';
import type {
  Article, ScoredArticle, AIClient, BatchResultMap, IndexedBatchItem, CategoryId, ContentType,
} from './types.js';

const CLASSIFICATION_BATCH_SIZE = 12;
const SCORING_BATCH_SIZE = 10;
const SUMMARY_BATCH_SIZE = 3;
const NEWS_SUMMARY_BATCH_SIZE = 8;
const MAX_CONCURRENT_GEMINI = 2;
const OPENAI_REASONING_TOKENS_PER_CLASSIFICATION_ITEM = 90;
const OPENAI_REASONING_TOKENS_PER_SCORING_ITEM = 80;
const OPENAI_REASONING_TOKENS_PER_SUMMARY_ITEM = 250;
const OPENAI_REASONING_TOKENS_PER_NEWS_ITEM = 120;
const OPENAI_REASONING_TOKENS_BASE = 128;

const VALID_CATEGORIES = new Set<string>(['ai-ml', 'security', 'engineering', 'tools', 'opinion', 'other']);

interface GeminiClassificationResult {
  results: Array<{
    index: number;
    content_type?: string;
    contentType?: string;
    event_cluster?: string | null;
    eventCluster?: string | null;
    is_duplicate_of_event?: boolean;
    isDuplicateOfEvent?: boolean;
    category?: string;
    keywords?: string[];
  }>;
}

interface GeminiScoringResult {
  results: Array<{
    index: number;
    relevance: number;
    quality: number;
    timeliness: number;
    category: string;
    keywords: string[];
  }>;
}

interface GeminiSummaryResult {
  results: Array<{
    index: number;
    titleZh: string;
    summary: string;
    editorial?: string;
    reason?: string;
  }>;
}

interface GeminiNewsSummaryResult {
  results: Array<{
    index: number;
    titleZh: string;
    summary: string;
  }>;
}

export function mapBatchResultsToArticleIndices<T extends { index: number }>(
  batch: IndexedBatchItem[],
  results: T[] | undefined,
  taskLabel: string,
): Array<{ articleIndex: number; result: T }> {
  if (!Array.isArray(results)) {
    throw new Error(`${taskLabel} returned no results array.`);
  }

  if (results.length !== batch.length) {
    throw new Error(`${taskLabel} returned ${results.length} results for ${batch.length} requested articles.`);
  }

  const mapped: Array<{ articleIndex: number; result: T }> = [];
  const seenBatchIndexes = new Set<number>();

  for (const result of results) {
    if (!Number.isInteger(result.index)) {
      throw new Error(`${taskLabel} returned a non-integer batch index: ${String(result.index)}`);
    }

    const batchIndex = result.index;
    if (batchIndex < 0 || batchIndex >= batch.length) {
      throw new Error(`${taskLabel} returned out-of-range batch index ${batchIndex} (expected 0-${batch.length - 1}).`);
    }

    if (seenBatchIndexes.has(batchIndex)) {
      throw new Error(`${taskLabel} returned duplicate batch index ${batchIndex}.`);
    }

    seenBatchIndexes.add(batchIndex);
    mapped.push({ articleIndex: batch[batchIndex]!.index, result });
  }

  return mapped;
}

function normalizeCategory(category: string | undefined): CategoryId {
  return (category && VALID_CATEGORIES.has(category) ? category : 'other') as CategoryId;
}

function normalizeContentType(contentType: string | undefined): ContentType {
  return contentType === 'news' ? 'news' : 'analysis';
}

function normalizeKeywords(keywords: unknown, limit = 5): string[] {
  if (!Array.isArray(keywords)) return [];
  return keywords
    .filter((keyword): keyword is string => typeof keyword === 'string' && keyword.trim().length > 0)
    .map(keyword => keyword.trim())
    .slice(0, limit);
}

function buildClassificationPrompt(articles: Array<{ index: number; title: string; description: string; sourceName: string }>): string {
  const articlesList = articles.map(a =>
    `Index ${a.index}: [${a.sourceName}] ${a.title}\n${a.description.slice(0, 500)}`
  ).join('\n\n---\n\n');

  return `你是"蒲公英技术日报"的分流编辑。请按 content_type 对文章做二分，并提取周刊聚类需要的 tag。

## 核心规则

- content_type 是唯一分流开关，只能是 "news" 或 "analysis"
- news: 时效依赖性强，晚一周读价值显著下降。例如官司进展、公司人事、产品发布、漏洞披露、融资收购、事故通报、政策变化
- analysis: 一周后读价值仍然存在。例如技术分析、教程、研究、观点、经验复盘、架构/语言/工具的深入文章
- event_cluster: 只有 news 需要。用 2-8 个中文词概括同一事件，例如 "OpenAI 审判"、"GPT-5 发布"、"Linux 提权漏洞"。analysis 返回 null
- is_duplicate_of_event: 本批次内同一 event_cluster 的非代表文章标 true；代表文章或 analysis 标 false
- category 必须从 ai-ml/security/engineering/tools/opinion/other 选一个
- keywords 提取 3-5 个短 tag，用英文技术名词优先；它们会进入 search-index.json 供周刊热点收敛使用

## 待分类文章

${articlesList}

请严格返回 JSON，必须为每个 Index 返回且只返回一条结果：
{
  "results": [
    {
      "index": 0,
      "content_type": "analysis",
      "event_cluster": null,
      "is_duplicate_of_event": false,
      "category": "engineering",
      "keywords": ["Rust", "compiler", "performance"]
    }
  ]
}`;
}

export async function classifyArticlesWithAI(
  articles: Article[],
  aiClient: AIClient
): Promise<BatchResultMap<{ contentType: ContentType; eventCluster: string | null; isDuplicateOfEvent: boolean; category: CategoryId; keywords: string[] }>> {
  const classifications = new Map<number, { contentType: ContentType; eventCluster: string | null; isDuplicateOfEvent: boolean; category: CategoryId; keywords: string[] }>();
  let failedBatches = 0;

  const indexed = articles.map((article, index) => ({
    index,
    title: article.title,
    description: article.description,
    sourceName: article.sourceName,
  }));

  const batches: typeof indexed[] = [];
  for (let i = 0; i < indexed.length; i += CLASSIFICATION_BATCH_SIZE) {
    batches.push(indexed.slice(i, i + CLASSIFICATION_BATCH_SIZE));
  }

  console.log(`[digest] AI classification: ${articles.length} articles in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_GEMINI) {
    const batchGroup = batches.slice(i, i + MAX_CONCURRENT_GEMINI);
    const promises = batchGroup.map(async (batch) => {
      try {
        const promptBatch = batch.map((item, batchIndex) => ({
          ...item,
          index: batchIndex,
        }));
        const prompt = buildClassificationPrompt(promptBatch);
        const parsed = await callJsonWithRetry<GeminiClassificationResult>(
          aiClient,
          prompt,
          'Classification batch',
          { maxCompletionTokens: OPENAI_REASONING_TOKENS_BASE + batch.length * OPENAI_REASONING_TOKENS_PER_CLASSIFICATION_ITEM }
        );

        for (const { articleIndex, result } of mapBatchResultsToArticleIndices(batch, parsed.results, 'Classification batch')) {
          const rawContentType = result.content_type ?? result.contentType;
          const contentType = normalizeContentType(rawContentType);
          const rawCluster = result.event_cluster ?? result.eventCluster ?? null;
          const eventCluster = contentType === 'news' && typeof rawCluster === 'string' && rawCluster.trim()
            ? rawCluster.trim()
            : null;

          classifications.set(articleIndex, {
            contentType,
            eventCluster,
            isDuplicateOfEvent: Boolean(result.is_duplicate_of_event ?? result.isDuplicateOfEvent ?? false),
            category: normalizeCategory(result.category),
            keywords: normalizeKeywords(result.keywords),
          });
        }
      } catch (error) {
        failedBatches++;
        console.warn(`[digest] Classification batch failed: ${error instanceof Error ? error.message : String(error)}`);
        for (const item of batch) {
          classifications.set(item.index, {
            contentType: 'analysis',
            eventCluster: null,
            isDuplicateOfEvent: false,
            category: 'other',
            keywords: [],
          });
        }
      }
    });

    await Promise.all(promises);
    console.log(`[digest] Classification progress: ${Math.min(i + MAX_CONCURRENT_GEMINI, batches.length)}/${batches.length} batches`);
  }

  return {
    values: classifications,
    failedBatches,
    totalBatches: batches.length,
  };
}

function buildScoringPrompt(articles: Array<{ index: number; title: string; description: string; sourceName: string }>): string {
  const articlesList = articles.map(a =>
    `Index ${a.index}: [${a.sourceName}] ${a.title}\n${a.description.slice(0, 300)}`
  ).join('\n\n---\n\n');

  return `你是一个技术内容策展人，正在为一份面向技术爱好者的每日精选摘要筛选文章。

请对以下文章进行三个维度的评分（1-10 整数，10 分最高），并为每篇文章分配一个分类标签和提取 2-4 个关键词。

## 评分维度

### 1. 相关性 (relevance) - 对技术/编程/AI/互联网从业者的价值
- 10: 所有技术人都应该知道的重大事件/突破
- 7-9: 对大部分技术从业者有价值
- 4-6: 对特定技术领域有价值
- 1-3: 与技术行业关联不大

### 2. 质量 (quality) - 文章本身的深度和写作质量
- 10: 深度分析，原创洞见，引用丰富
- 7-9: 有深度，观点独到
- 4-6: 信息准确，表达清晰
- 1-3: 浅尝辄止或纯转述

### 3. 时效性 (timeliness) - 当前是否值得阅读
- 10: 正在发生的重大事件/刚发布的重要工具
- 7-9: 近期热点相关
- 4-6: 常青内容，不过时
- 1-3: 过时或无时效价值

## 分类标签（必须从以下选一个）
- ai-ml: AI、机器学习、LLM、深度学习相关
- security: 安全、隐私、漏洞、加密相关
- engineering: 软件工程、架构、编程语言、系统设计
- tools: 开发工具、开源项目、新发布的库/框架
- opinion: 行业观点、个人思考、职业发展、文化评论
- other: 以上都不太适合的

## 关键词提取
提取 2-4 个最能代表文章主题的关键词（用英文，简短，如 "Rust", "LLM", "database", "performance"）

## 返回索引要求
- 每篇文章前面的 Index 是本批次内的唯一编号，范围从 0 开始连续递增
- 返回结果时，必须原样使用该 Index
- 必须为本批次中的每一篇文章都返回且只返回一条结果

## 待评分文章

${articlesList}

请严格按 JSON 格式返回，不要包含 markdown 代码块或其他文字：
{
  "results": [
    {
      "index": 0,
      "relevance": 8,
      "quality": 7,
      "timeliness": 9,
      "category": "engineering",
      "keywords": ["Rust", "compiler", "performance"]
    }
  ]
}`;
}

export async function scoreArticlesWithAI(
  articles: Article[],
  aiClient: AIClient
): Promise<BatchResultMap<{ relevance: number; quality: number; timeliness: number; category: CategoryId; keywords: string[] }>> {
  const allScores = new Map<number, { relevance: number; quality: number; timeliness: number; category: CategoryId; keywords: string[] }>();
  let failedBatches = 0;

  const indexed = articles.map((article, index) => ({
    index,
    title: article.title,
    description: article.description,
    sourceName: article.sourceName,
  }));

  const batches: typeof indexed[] = [];
  for (let i = 0; i < indexed.length; i += SCORING_BATCH_SIZE) {
    batches.push(indexed.slice(i, i + SCORING_BATCH_SIZE));
  }

  console.log(`[digest] AI scoring: ${articles.length} articles in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_GEMINI) {
    const batchGroup = batches.slice(i, i + MAX_CONCURRENT_GEMINI);
    const promises = batchGroup.map(async (batch) => {
      try {
        const promptBatch = batch.map((item, batchIndex) => ({
          ...item,
          index: batchIndex,
        }));
        const prompt = buildScoringPrompt(promptBatch);
        const parsed = await callJsonWithRetry<GeminiScoringResult>(
          aiClient,
          prompt,
          'Scoring batch',
          { maxCompletionTokens: OPENAI_REASONING_TOKENS_BASE + batch.length * OPENAI_REASONING_TOKENS_PER_SCORING_ITEM }
        );

        for (const { articleIndex, result } of mapBatchResultsToArticleIndices(batch, parsed.results, 'Scoring batch')) {
          const clamp = (v: number) => Math.min(10, Math.max(1, Math.round(v)));
          allScores.set(articleIndex, {
            relevance: clamp(result.relevance),
            quality: clamp(result.quality),
            timeliness: clamp(result.timeliness),
            category: normalizeCategory(result.category),
            keywords: normalizeKeywords(result.keywords, 5),
          });
        }
      } catch (error) {
        failedBatches++;
        console.warn(`[digest] Scoring batch failed: ${error instanceof Error ? error.message : String(error)}`);
        for (const item of batch) {
          allScores.set(item.index, { relevance: 1, quality: 1, timeliness: 1, category: 'other', keywords: [] });
        }
      }
    });

    await Promise.all(promises);
    console.log(`[digest] Scoring progress: ${Math.min(i + MAX_CONCURRENT_GEMINI, batches.length)}/${batches.length} batches`);
  }

  return {
    values: allScores,
    failedBatches,
    totalBatches: batches.length,
  };
}

function buildSummaryPrompt(
  articles: Array<{ index: number; title: string; description: string; sourceName: string; link: string }>,
  lang: 'zh' | 'en'
): string {
  const articlesList = articles.map(a =>
    `Index ${a.index}: [${a.sourceName}] ${a.title}\nURL: ${a.link}\n${a.description}`
  ).join('\n\n---\n\n');

  const langInstruction = lang === 'zh'
    ? '请用中文撰写摘要和编辑视角。如果原文是英文，请翻译为中文。标题翻译也用中文。'
    : 'Write summaries, editorial notes, and title translations in English.';

  return `你是一个技术内容摘要专家。请为以下文章完成三件事：

1. **中文标题** (titleZh): 将英文标题翻译成自然的中文。如果原标题已经是中文则保持不变。
2. **摘要** (summary): 4-6 句话的结构化摘要，让读者不点进原文也能了解核心内容。包含：
   - 文章讨论的核心问题或主题（1 句）
   - 关键论点、技术方案或发现（2-3 句）
   - 结论或作者的核心观点（1 句）
3. **编辑视角** (editorial): 1 句话说明"这篇文章在今天的上下文里意味着什么，或与其他文章形成怎样的呼应"。

${langInstruction}

摘要要求：
- 直接说重点，不要用"本文讨论了..."、"这篇文章介绍了..."这种开头
- 包含具体的技术名词、数据、方案名称或观点
- 保留关键数字和指标（如性能提升百分比、用户数、版本号等）
- 如果文章涉及对比或选型，要点出比较对象和结论
- 目标：读者花 30 秒读完摘要，就能决定是否值得花 10 分钟读原文
- 编辑视角不能写"这篇文章值得读是因为..."，不能说"揭露了..."、"警示了..."等万能句式
- 编辑视角必须包含具体判断或洞察，可以联系同日其他技术趋势
- 返回结果时，必须使用本批次里显示的 Index，范围从 0 开始连续递增
- 必须为本批次中的每一篇文章都返回且只返回一条结果

## 待摘要文章

${articlesList}

请严格按 JSON 格式返回：
{
  "results": [
    {
      "index": 0,
      "titleZh": "中文翻译的标题",
      "summary": "摘要内容...",
      "editorial": "编辑视角..."
    }
  ]
}`;
}

export async function summarizeArticles(
  articles: Array<Article & { index: number }>,
  aiClient: AIClient,
  lang: 'zh' | 'en'
): Promise<BatchResultMap<{ titleZh: string; summary: string; editorial: string }>> {
  const summaries = new Map<number, { titleZh: string; summary: string; editorial: string }>();
  let failedBatches = 0;

  const indexed = articles.map(a => ({
    index: a.index,
    title: a.title,
    description: a.description,
    sourceName: a.sourceName,
    link: a.link,
  }));

  const batches: typeof indexed[] = [];
  for (let i = 0; i < indexed.length; i += SUMMARY_BATCH_SIZE) {
    batches.push(indexed.slice(i, i + SUMMARY_BATCH_SIZE));
  }

  console.log(`[digest] Generating summaries for ${articles.length} articles in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_GEMINI) {
    const batchGroup = batches.slice(i, i + MAX_CONCURRENT_GEMINI);
    const promises = batchGroup.map(async (batch) => {
      try {
        const promptBatch = batch.map((item, batchIndex) => ({
          ...item,
          index: batchIndex,
        }));
        const prompt = buildSummaryPrompt(promptBatch, lang);
        const parsed = await callJsonWithRetry<GeminiSummaryResult>(
          aiClient,
          prompt,
          'Summary batch',
          { maxCompletionTokens: OPENAI_REASONING_TOKENS_BASE + batch.length * OPENAI_REASONING_TOKENS_PER_SUMMARY_ITEM }
        );

        for (const { articleIndex, result } of mapBatchResultsToArticleIndices(batch, parsed.results, 'Summary batch')) {
          summaries.set(articleIndex, {
            titleZh: result.titleZh || '',
            summary: result.summary || '',
            editorial: result.editorial || result.reason || '',
          });
        }
      } catch (error) {
        failedBatches++;
        console.warn(`[digest] Summary batch failed: ${error instanceof Error ? error.message : String(error)}`);
        for (const item of batch) {
          summaries.set(item.index, { titleZh: item.title, summary: item.title, editorial: '' });
        }
      }
    });

    await Promise.all(promises);
    console.log(`[digest] Summary progress: ${Math.min(i + MAX_CONCURRENT_GEMINI, batches.length)}/${batches.length} batches`);
  }

  return {
    values: summaries,
    failedBatches,
    totalBatches: batches.length,
  };
}

function buildNewsSummaryPrompt(
  articles: Array<{ index: number; title: string; description: string; sourceName: string; link: string; eventCluster: string | null }>,
  lang: 'zh' | 'en'
): string {
  const articlesList = articles.map(a =>
    `Index ${a.index}: [${a.sourceName}] ${a.title}\nEvent: ${a.eventCluster || '未命名事件'}\nURL: ${a.link}\n${a.description.slice(0, 500)}`
  ).join('\n\n---\n\n');

  const langInstruction = lang === 'zh'
    ? '请用中文返回 titleZh 和 summary。'
    : 'Write titleZh and summary in English.';

  return `你是"蒲公英技术日报"的快讯编辑。以下都是 news 类文章：晚一周读价值会明显下降，只需要一句话快讯。

要求：
- titleZh 是自然标题，不要夸张
- summary 只写一句话，80 字以内，交代发生了什么和为什么当天需要知道
- 不写推荐理由，不写长摘要，不加主观煽动
- 必须为每个 Index 返回且只返回一条结果
${langInstruction}

## 待处理文章

${articlesList}

请严格返回 JSON：
{
  "results": [
    {
      "index": 0,
      "titleZh": "中文标题",
      "summary": "一句话快讯。"
    }
  ]
}`;
}

export async function summarizeNewsArticles(
  articles: Array<Article & { index: number; eventCluster: string | null }>,
  aiClient: AIClient,
  lang: 'zh' | 'en'
): Promise<BatchResultMap<{ titleZh: string; summary: string }>> {
  const summaries = new Map<number, { titleZh: string; summary: string }>();
  let failedBatches = 0;

  const indexed = articles.map(a => ({
    index: a.index,
    title: a.title,
    description: a.description,
    sourceName: a.sourceName,
    link: a.link,
    eventCluster: a.eventCluster,
  }));

  const batches: typeof indexed[] = [];
  for (let i = 0; i < indexed.length; i += NEWS_SUMMARY_BATCH_SIZE) {
    batches.push(indexed.slice(i, i + NEWS_SUMMARY_BATCH_SIZE));
  }

  console.log(`[digest] Generating flash summaries for ${articles.length} news items in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_GEMINI) {
    const batchGroup = batches.slice(i, i + MAX_CONCURRENT_GEMINI);
    const promises = batchGroup.map(async (batch) => {
      try {
        const promptBatch = batch.map((item, batchIndex) => ({
          ...item,
          index: batchIndex,
        }));
        const prompt = buildNewsSummaryPrompt(promptBatch, lang);
        const parsed = await callJsonWithRetry<GeminiNewsSummaryResult>(
          aiClient,
          prompt,
          'News summary batch',
          { maxCompletionTokens: OPENAI_REASONING_TOKENS_BASE + batch.length * OPENAI_REASONING_TOKENS_PER_NEWS_ITEM }
        );

        for (const { articleIndex, result } of mapBatchResultsToArticleIndices(batch, parsed.results, 'News summary batch')) {
          summaries.set(articleIndex, {
            titleZh: result.titleZh || '',
            summary: result.summary || '',
          });
        }
      } catch (error) {
        failedBatches++;
        console.warn(`[digest] News summary batch failed: ${error instanceof Error ? error.message : String(error)}`);
        for (const item of batch) {
          summaries.set(item.index, { titleZh: item.title, summary: item.description.slice(0, 120) || item.title });
        }
      }
    });

    await Promise.all(promises);
    console.log(`[digest] News summary progress: ${Math.min(i + MAX_CONCURRENT_GEMINI, batches.length)}/${batches.length} batches`);
  }

  return {
    values: summaries,
    failedBatches,
    totalBatches: batches.length,
  };
}

export async function generateHighlights(
  articles: ScoredArticle[],
  aiClient: AIClient,
  lang: 'zh' | 'en'
): Promise<string> {
  const articleList = articles.slice(0, 10).map((a, i) =>
    `${i + 1}. [${a.category}] ${a.titleZh || a.title} — ${a.summary.slice(0, 100)}`
  ).join('\n');

  const langNote = lang === 'zh' ? '用中文回答。' : 'Write in English.';

  const prompt = `根据以下今日精选技术文章列表，写一段 3-5 句话的"今日看点"总结。
要求：
- 提炼出今天技术圈的 2-3 个主要趋势或话题
- 不要逐篇列举，要做宏观归纳
- 风格简洁有力，像新闻导语
${langNote}

文章列表：
${articleList}

直接返回纯文本总结，不要 JSON，不要 markdown 格式。`;

  try {
    const text = await aiClient.call(prompt, {
      responseType: 'text',
      maxCompletionTokens: OPENAI_REASONING_TOKENS_BASE + 384,
    });
    return text.trim();
  } catch (error) {
    console.warn(`[digest] Highlights generation failed: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}
