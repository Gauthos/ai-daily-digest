import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';

import { formatHawaiiDate, formatHawaiiCompactDate } from './types.js';
import type { CategoryId, ScoredArticle } from './types.js';
import { RSS_FEEDS, fetchAllFeeds } from './feeds.js';
import { createAIClient, inferOpenAIModel } from './ai-client.js';
import { scoreArticlesWithAI, summarizeArticles, generateHighlights } from './scoring.js';
import { generateDigestReport } from './report.js';

const OPENAI_DEFAULT_API_BASE = 'https://api.openai.com/v1';

function printUsage(): never {
  console.log(`AI Daily Digest - AI-powered RSS digest from 90 top tech blogs

Usage:
  bun scripts/digest.ts [options]

Options:
  --hours <n>     Time range in hours (default: 48)
  --top-n <n>     Number of top articles to include (default: 15)
  --lang <lang>   Summary language: zh or en (default: zh)
  --output <path> Output file path (default: ./digest-YYYYMMDD.md)
  --help          Show this help

Environment:
  GEMINI_API_KEY   Optional but recommended. Get one at https://aistudio.google.com/apikey
  OPENAI_API_KEY   Optional fallback key for OpenAI-compatible APIs
  OPENAI_API_BASE  Optional fallback base URL (default: https://api.openai.com/v1)
  OPENAI_MODEL     Optional fallback model (default: deepseek-chat for DeepSeek base, else gpt-4o-mini)

Examples:
  bun scripts/digest.ts --hours 24 --top-n 10 --lang zh
  bun scripts/digest.ts --hours 72 --top-n 20 --lang en --output ./my-digest.md
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  let hours = 48;
  let topN = 15;
  let lang: 'zh' | 'en' = 'zh';
  let outputPath = '';

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

  if (!outputPath) {
    const dateStr = formatHawaiiCompactDate(new Date());
    outputPath = `./digest-${dateStr}.md`;
  }

  console.log(`[digest] === AI Daily Digest ===`);
  console.log(`[digest] Time range: ${hours} hours`);
  console.log(`[digest] Top N: ${topN}`);
  console.log(`[digest] Language: ${lang}`);
  console.log(`[digest] Output: ${outputPath}`);
  console.log(`[digest] AI provider: ${geminiApiKey ? 'Gemini (primary)' : 'OpenAI-compatible (primary)'}`);
  if (openaiApiKey) {
    const resolvedBase = (openaiApiBase?.trim() || OPENAI_DEFAULT_API_BASE).replace(/\/+$/, '');
    const resolvedModel = openaiModel?.trim() || inferOpenAIModel(resolvedBase);
    console.log(`[digest] Fallback: ${resolvedBase} (model=${resolvedModel})`);
  }
  console.log('');

  console.log(`[digest] Step 1/5: Fetching ${RSS_FEEDS.length} RSS feeds...`);
  const allArticles = await fetchAllFeeds(RSS_FEEDS);

  if (allArticles.length === 0) {
    console.error('[digest] Error: No articles fetched from any feed. Check network connection.');
    process.exit(1);
  }

  console.log(`[digest] Step 2/5: Filtering by time range (${hours} hours)...`);
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  const recentArticles = allArticles.filter(a => a.pubDate.getTime() > cutoffTime.getTime());

  const seenUrls = new Set<string>();
  const uniqueArticles = recentArticles.filter(a => {
    const normalized = a.link.replace(/\/+$/, '').toLowerCase();
    if (seenUrls.has(normalized)) return false;
    seenUrls.add(normalized);
    return true;
  });
  const dupeCount = recentArticles.length - uniqueArticles.length;
  if (dupeCount > 0) {
    console.log(`[digest] Removed ${dupeCount} duplicate articles`);
  }

  console.log(`[digest] Found ${uniqueArticles.length} unique articles within last ${hours} hours`);

  if (uniqueArticles.length === 0) {
    console.error(`[digest] Error: No articles found within the last ${hours} hours.`);
    console.error(`[digest] Try increasing --hours (e.g., --hours 168 for one week)`);
    process.exit(1);
  }

  console.log(`[digest] Step 3/5: AI scoring ${uniqueArticles.length} articles...`);
  const scoringResult = await scoreArticlesWithAI(uniqueArticles, aiClient);
  const scores = scoringResult.values;

  if (scoringResult.totalBatches > 0 && scoringResult.failedBatches === scoringResult.totalBatches) {
    console.error('[digest] Error: AI scoring failed for every batch. Check Actions secrets and provider settings.');
    console.error('[digest] Expected at least one successful scoring batch, but all requests fell back to default scores.');
    process.exit(1);
  }

  const scoredArticles = uniqueArticles.map((article, index) => {
    const score = scores.get(index) || { relevance: 1, quality: 1, timeliness: 1, category: 'other' as CategoryId, keywords: [] };
    return {
      ...article,
      totalScore: score.relevance + score.quality + score.timeliness,
      breakdown: score,
    };
  });

  scoredArticles.sort((a, b) => b.totalScore - a.totalScore);
  const topArticles = scoredArticles.slice(0, topN);

  console.log(`[digest] Top ${topN} articles selected (score range: ${topArticles[topArticles.length - 1]?.totalScore || 0} - ${topArticles[0]?.totalScore || 0})`);

  console.log(`[digest] Step 4/5: Generating AI summaries...`);
  const indexedTopArticles = topArticles.map((a, i) => ({ ...a, index: i }));
  const summaryResult = await summarizeArticles(indexedTopArticles, aiClient, lang);
  const summaries = summaryResult.values;

  if (summaryResult.totalBatches > 0 && summaryResult.failedBatches === summaryResult.totalBatches) {
    console.error('[digest] Error: AI summarization failed for every batch. Check Actions secrets and provider settings.');
    console.error('[digest] Expected at least one successful summary batch, but all requests fell back to raw titles.');
    process.exit(1);
  }

  const finalArticles: ScoredArticle[] = topArticles.map((a, i) => {
    const sm = summaries.get(i) || { titleZh: a.title, summary: a.description.slice(0, 200), reason: '' };
    return {
      title: a.title,
      link: a.link,
      pubDate: a.pubDate,
      description: a.description,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
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
      reason: sm.reason,
    };
  });

  console.log(`[digest] Step 5/5: Generating today's highlights...`);
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

  const digestDate = formatHawaiiDate(new Date());
  const articlesIndex = finalArticles.map(a => ({
    date: digestDate,
    pubDate: a.pubDate.toISOString(),
    title: a.title,
    titleZh: a.titleZh,
    link: a.link,
    source: a.sourceName,
    sourceUrl: a.sourceUrl,
    category: a.category,
    tags: a.keywords,
    score: a.score,
    scoreBreakdown: a.scoreBreakdown,
    summary: a.summary,
    description: a.description.slice(0, 500),
    reason: a.reason,
  }));
  const articlesPath = outputPath.replace(/\.md$/, '.articles.json');
  await writeFile(articlesPath, JSON.stringify(articlesIndex, null, 2) + '\n');

  console.log('');
  console.log(`[digest] ✅ Done!`);
  console.log(`[digest] 📁 Report: ${outputPath}`);
  console.log(`[digest] 📊 Stats: ${successfulSources.size} sources → ${allArticles.length} articles → ${uniqueArticles.length} recent → ${finalArticles.length} selected`);

  if (finalArticles.length > 0) {
    console.log('');
    console.log(`[digest] 🏆 Top 3 Preview:`);
    for (let i = 0; i < Math.min(3, finalArticles.length); i++) {
      const a = finalArticles[i];
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
