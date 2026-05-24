import {
  CATEGORY_META, getHawaiiDateTimeParts, formatHawaiiDate,
} from './types.js';
import type { ScoredArticle } from './types.js';
import { generateShareId, topItemAnchor } from './share-utils.js';

function humanizeTime(pubDate: Date): string {
  const diffMs = Date.now() - pubDate.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return formatHawaiiDate(pubDate);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFeedback(article: ScoredArticle, shareId: string): string {
  return `<div class="article-feedback" data-article-id="item-${shareId}" data-source="${escapeHtml(article.sourceName)}" data-category="${article.category}" data-score="${article.score}">
  <span class="feedback-hint">这个视角对你有用吗？</span>
  <button class="feedback-btn feedback-up" type="button" data-vote="up" aria-label="有用"><img src="https://img.icons8.com/hatch/64/facebook-like.png" alt="like" width="20" height="20" loading="lazy"></button>
  <button class="feedback-btn feedback-down" type="button" data-vote="down" aria-label="没用"><img src="https://img.icons8.com/hatch/64/dislike.png" alt="dislike" width="20" height="20" loading="lazy"></button>
</div>`;
}

function renderEditorial(article: ScoredArticle, shareId: string): string {
  if (!article.editorial) return '';
  return `<div class="editorial-note">
  <p>${escapeHtml(article.editorial)}</p>
  <p class="editorial-note__byline">-- 蒲公英</p>
  ${renderFeedback(article, shareId)}
</div>

`;
}

export function generateDigestReport(articles: ScoredArticle[], highlights: string, stats: {
  totalFeeds: number;
  successFeeds: number;
  totalArticles: number;
  filteredArticles: number;
  hours: number;
  lang: string;
}): string {
  const now = new Date();
  const { date: dateStr, time: timeStr } = getHawaiiDateTimeParts(now);
  const deepReads = articles.filter(a => a.contentType === 'analysis');
  const flashNews = articles.filter(a => a.contentType === 'news');

  let report = `---\n`;
  report += `title: "AI 博客每日精选 — ${dateStr}"\n`;
  report += `date: ${dateStr}T${timeStr}:00-10:00\n`;
  report += `summary: "${highlights ? highlights.slice(0, 150).replace(/"/g, '\\"').replace(/\n/g, ' ') : `来自 ${stats.totalFeeds} 个顶级技术博客，AI 精选 ${deepReads.length} 篇深读与 ${flashNews.length} 条快讯`}"\n`;
  report += `---\n\n`;

  report += `> 来自 Karpathy 推荐的 ${stats.totalFeeds} 个顶级技术博客，AI 精选 ${deepReads.length} 篇深读与 ${flashNews.length} 条快讯\n\n`;

  if (highlights) {
    report += `## 📝 今日看点\n\n`;
    report += `${highlights}\n\n`;
    report += `---\n\n`;
  }

  if (deepReads.length >= 3) {
    report += `## 🏆 今日必读\n\n`;
    for (let i = 0; i < Math.min(3, deepReads.length); i++) {
      const a = deepReads[i]!;
      const medal = ['🥇', '🥈', '🥉'][i];
      const catMeta = CATEGORY_META[a.category];
      const itemTitle = a.titleZh || a.title;
      const shareId = generateShareId(a.link);

      report += `${medal} **${itemTitle}**${topItemAnchor(shareId)}\n\n`;
      report += `[${a.title}](${a.link}) — ${a.sourceName} · ${humanizeTime(a.pubDate)} · ${catMeta.emoji} ${catMeta.label}\n\n`;
      report += `> ${a.summary}\n\n`;
      report += renderEditorial(a, shareId);
    }
    report += `---\n\n`;
  }

  if (flashNews.length > 0) {
    report += `## ⚡ 快讯\n\n`;
    for (const a of flashNews) {
      const label = a.eventCluster ? `**${a.eventCluster}**: ` : '';
      report += `- ${label}[${a.titleZh || a.title}](${a.link}) — ${a.sourceName} · ${humanizeTime(a.pubDate)}  \n`;
      report += `  ${a.summary}\n`;
      if ((a.relatedArticles || []).length > 0) {
        const related = a.relatedArticles!
          .slice(0, 3)
          .map(item => `[${item.sourceName}](${item.link})`)
          .join('、');
        report += `  同一事件的其他报道：${related}\n`;
      }
    }
    report += `\n---\n\n`;
  }

  const categoryGroups = new Map<string, ScoredArticle[]>();
  for (const a of deepReads) {
    const list = categoryGroups.get(a.category) || [];
    list.push(a);
    categoryGroups.set(a.category, list);
  }

  const sortedCategories = Array.from(categoryGroups.entries())
    .sort((a, b) => b[1].length - a[1].length);

  let globalIndex = 0;
  for (const [catId, catArticles] of sortedCategories) {
    const catMeta = CATEGORY_META[catId as keyof typeof CATEGORY_META];
    report += `## ${catMeta.emoji} ${catMeta.label}\n\n`;

    for (const a of catArticles) {
      globalIndex++;
      const shareId = generateShareId(a.link);

      report += `### ${globalIndex}. ${a.titleZh || a.title} {#item-${shareId}}\n\n`;
      report += `[${a.title}](${a.link}) — **${a.sourceName}** · ${humanizeTime(a.pubDate)}\n\n`;
      report += `> ${a.summary}\n\n`;
      report += renderEditorial(a, shareId);
      report += `---\n\n`;
    }
  }

  report += `*生成于 ${dateStr} ${timeStr} (Pacific/Honolulu) | 扫描 ${stats.successFeeds} 源 → 获取 ${stats.totalArticles} 篇 → 深读 ${deepReads.length} 篇 · 快讯 ${flashNews.length} 条*\n`;
  report += `*基于 [Hacker News Popularity Contest 2025](https://refactoringenglish.com/tools/hn-popularity/) RSS 源列表，由 [Andrej Karpathy](https://x.com/karpathy) 推荐*\n`;

  return report;
}
