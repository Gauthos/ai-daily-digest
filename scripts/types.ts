export const HAWAII_TIME_ZONE = 'Pacific/Honolulu';

export const HAWAII_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: HAWAII_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  hour12: false,
});

export type CategoryId = 'ai-ml' | 'security' | 'engineering' | 'tools' | 'opinion' | 'other';

export const CATEGORY_META: Record<CategoryId, { emoji: string; label: string }> = {
  'ai-ml':       { emoji: '🤖', label: 'AI / ML' },
  'security':    { emoji: '🔒', label: '安全' },
  'engineering': { emoji: '⚙️', label: '工程' },
  'tools':       { emoji: '🛠', label: '工具 / 开源' },
  'opinion':     { emoji: '💡', label: '观点 / 杂谈' },
  'other':       { emoji: '📝', label: '其他' },
};

export interface Article {
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  sourceName: string;
  sourceUrl: string;
}

export interface ScoredArticle extends Article {
  score: number;
  scoreBreakdown: {
    relevance: number;
    quality: number;
    timeliness: number;
  };
  category: CategoryId;
  keywords: string[];
  titleZh: string;
  summary: string;
  reason: string;
}

export interface AIRequestOptions {
  responseType?: 'json' | 'text';
  maxCompletionTokens?: number;
}

export interface AIClient {
  call(prompt: string, options?: AIRequestOptions): Promise<string>;
}

export interface BatchResultMap<T> {
  values: Map<number, T>;
  failedBatches: number;
  totalBatches: number;
}

export interface IndexedBatchItem {
  index: number;
}

export function getHawaiiDateTimeParts(date: Date): { date: string; time: string } {
  const values = new Map<string, string>();

  for (const part of HAWAII_DATE_TIME_FORMATTER.formatToParts(date)) {
    if (part.type !== 'literal') {
      values.set(part.type, part.value);
    }
  }

  const year = values.get('year') || '0000';
  const month = values.get('month') || '01';
  const day = values.get('day') || '01';
  const hour = values.get('hour') || '00';
  const minute = values.get('minute') || '00';

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  };
}

export function formatHawaiiDate(date: Date): string {
  return getHawaiiDateTimeParts(date).date;
}

export function formatHawaiiCompactDate(date: Date): string {
  return formatHawaiiDate(date).replace(/-/g, '');
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
