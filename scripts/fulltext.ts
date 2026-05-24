import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import process from 'node:process';

import type { Article } from './types.js';

const ARTICLE_FETCH_TIMEOUT_MS = 20_000;
const ARTICLE_FETCH_CONCURRENCY = 3;
const MIN_ARTICLE_TEXT_LENGTH = 600;
const PROXY_URL = process.env.FEED_PROXY_URL || '';
const REQUEST_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

export interface FullTextResult<T extends Article> {
  articles: T[];
  fetched: number;
  failed: number;
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function cleanText(value: string | null | undefined): string {
  return normalizeWhitespace(value || '');
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
}

function textContent(node: Node): string {
  return cleanText(node.textContent || '');
}

function renderNode(node: Node, depth = 0): string {
  if (node.nodeType === node.TEXT_NODE) {
    return cleanText(node.textContent || '');
  }

  if (node.nodeType !== node.ELEMENT_NODE) return '';

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const childText = () => renderChildren(el, depth);

  if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'svg') return '';
  if (tag === 'br') return '\n';
  if (tag === 'p') return `${childText()}\n\n`;
  if (/^h[1-6]$/.test(tag)) {
    const level = Math.min(6, Math.max(2, Number(tag.slice(1)) + depth));
    return `${'#'.repeat(level)} ${textContent(el)}\n\n`;
  }
  if (tag === 'pre') {
    return `\n\`\`\`\n${(el.textContent || '').trim()}\n\`\`\`\n\n`;
  }
  if (tag === 'code') {
    return `\`${(el.textContent || '').trim().replace(/`/g, '\\`')}\``;
  }
  if (tag === 'blockquote') {
    return childText()
      .split('\n')
      .map(line => line.trim() ? `> ${line}` : '>')
      .join('\n') + '\n\n';
  }
  if (tag === 'ul' || tag === 'ol') {
    return Array.from(el.children)
      .map((child, index) => renderListItem(child, tag === 'ol' ? `${index + 1}.` : '-', depth))
      .filter(Boolean)
      .join('') + '\n';
  }
  if (tag === 'li') return renderListItem(el, '-', depth);
  if (tag === 'a') {
    const label = textContent(el);
    const href = el.getAttribute('href') || '';
    if (!label) return '';
    return href ? `[${label}](${href})` : label;
  }
  if (tag === 'strong' || tag === 'b') {
    const value = childText();
    return value ? `**${value}**` : '';
  }
  if (tag === 'em' || tag === 'i') {
    const value = childText();
    return value ? `*${value}*` : '';
  }

  return childText();
}

function renderChildren(el: Element, depth = 0): string {
  return Array.from(el.childNodes)
    .map(child => renderNode(child, depth))
    .filter(Boolean)
    .join(' ');
}

function renderListItem(el: Element, marker: string, depth: number): string {
  const content = renderChildren(el, depth + 1)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!content) return '';

  const indent = '  '.repeat(depth);
  const lines = content.split('\n');
  const first = `${indent}${marker} ${lines[0] || ''}`;
  const rest = lines.slice(1).map(line => line.trim() ? `${indent}  ${line}` : '').join('\n');
  return rest ? `${first}\n${rest}\n` : `${first}\n`;
}

function htmlToMarkdown(html: string): string {
  const dom = new JSDOM(`<article>${html}</article>`);
  const article = dom.window.document.querySelector('article');
  if (!article) return '';

  const markdown = renderChildren(article)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return normalizeWhitespace(markdown);
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT_MS);

  try {
    const options: RequestInit & { proxy?: string } = {
      signal: controller.signal,
      headers: {
        'User-Agent': REQUEST_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    if (PROXY_URL) options.proxy = PROXY_URL;

    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.includes('html') && !contentType.includes('xml')) {
      throw new Error(`unsupported content type: ${contentType}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchReadableMarkdown(article: Article): Promise<string | null> {
  const html = await fetchHtml(article.link);
  const dom = new JSDOM(html, { url: article.link });
  const reader = new Readability(dom.window.document);
  const parsed = reader.parse();
  if (!parsed) return null;

  const markdown = htmlToMarkdown(parsed.content || '');
  const fallbackText = cleanText(parsed.textContent);
  const body = markdown.length >= MIN_ARTICLE_TEXT_LENGTH ? markdown : fallbackText;
  if (body.length < MIN_ARTICLE_TEXT_LENGTH) return null;

  const title = cleanText(parsed.title) || article.title;
  return `# ${escapeMarkdown(title)}\n\n${body}`;
}

export async function enrichArticlesWithFullText<T extends Article>(articles: T[]): Promise<FullTextResult<T>> {
  const enriched = articles.map(article => ({ ...article }));
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < enriched.length; i += ARTICLE_FETCH_CONCURRENCY) {
    const batch = enriched.slice(i, i + ARTICLE_FETCH_CONCURRENCY);
    await Promise.all(batch.map(async (article) => {
      try {
        const fullText = await fetchReadableMarkdown(article);
        if (!fullText) {
          failed++;
          return;
        }

        article.description = fullText;
        fetched++;
      } catch (error) {
        failed++;
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[digest] Full text fallback for "${article.title.slice(0, 80)}": ${reason}`);
      }
    }));
  }

  return { articles: enriched, fetched, failed };
}
