import {
  CATEGORY_META, getHawaiiDateTimeParts, formatHawaiiDate,
} from './types.js';
import type { ScoredArticle } from './types.js';
import { createHash } from 'node:crypto';

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

const SHARE_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  + '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>'
  + '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'
  + '</svg>';

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

  let report = `---\n`;
  report += `title: "AI 博客每日精选 — ${dateStr}"\n`;
  report += `date: ${dateStr}T${timeStr}:00-10:00\n`;
  report += `summary: "${highlights ? highlights.slice(0, 150).replace(/"/g, '\\"').replace(/\n/g, ' ') : `来自 ${stats.totalFeeds} 个顶级技术博客，AI 精选 Top ${articles.length}`}"\n`;
  report += `---\n\n`;

  report += `> 来自 Karpathy 推荐的 ${stats.totalFeeds} 个顶级技术博客，AI 精选 Top ${articles.length}\n\n`;

  if (highlights) {
    report += `## 📝 今日看点\n\n`;
    report += `${highlights}\n\n`;
    report += `---\n\n`;
  }

  if (articles.length >= 3) {
    report += `## 🏆 今日必读\n\n`;
    for (let i = 0; i < Math.min(3, articles.length); i++) {
      const a = articles[i];
      const medal = ['🥇', '🥈', '🥉'][i];
      const catMeta = CATEGORY_META[a.category];
      const itemTitle = a.titleZh || a.title;
      const shareBtn = shareInlineButton({
        dateStr,
        shareId: generateShareId(a.link),
        pageTitle: `AI 博客每日精选 — ${dateStr}`,
        itemTitle,
      });

      report += `${medal} **${itemTitle}**${shareBtn}\n\n`;
      report += `[${a.title}](${a.link}) — ${a.sourceName} · ${humanizeTime(a.pubDate)} · ${catMeta.emoji} ${catMeta.label}\n\n`;
      report += `> ${a.summary}\n\n`;
      if (a.reason) {
        report += `💡 **为什么值得读**: ${a.reason}\n\n`;
      }
      if (a.keywords.length > 0) {
        report += `🏷️ ${a.keywords.join(', ')}\n\n`;
      }
    }
    report += `---\n\n`;
  }

  const categoryGroups = new Map<string, ScoredArticle[]>();
  for (const a of articles) {
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
      const scoreTotal = a.scoreBreakdown.relevance + a.scoreBreakdown.quality + a.scoreBreakdown.timeliness;

      report += `### ${globalIndex}. ${a.titleZh || a.title} {#item-${generateShareId(a.link)}}\n\n`;
      report += `[${a.title}](${a.link}) — **${a.sourceName}** · ${humanizeTime(a.pubDate)} · ⭐ ${scoreTotal}/30\n\n`;
      report += `> ${a.summary}\n\n`;
      if (a.keywords.length > 0) {
        report += `🏷️ ${a.keywords.join(', ')}\n\n`;
      }
      report += `---\n\n`;
    }
  }

  report += `*生成于 ${dateStr} ${timeStr} (Pacific/Honolulu) | 扫描 ${stats.successFeeds} 源 → 获取 ${stats.totalArticles} 篇 → 精选 ${articles.length} 篇*\n`;
  report += `*基于 [Hacker News Popularity Contest 2025](https://refactoringenglish.com/tools/hn-popularity/) RSS 源列表，由 [Andrej Karpathy](https://x.com/karpathy) 推荐*\n`;

  return report;
}
