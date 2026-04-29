import { sleep } from './types.js';
import type { AIClient, AIRequestOptions } from './types.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const OPENAI_DEFAULT_API_BASE = 'https://api.openai.com/v1';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
const AI_JSON_MAX_ATTEMPTS = 2;
const AI_REQUEST_TIMEOUT_MS = 180_000;
const AI_REQUEST_DELAY_MS = 8_000;

function extractTextParts(parts: Array<{ text?: string }> | undefined): string {
  if (!Array.isArray(parts)) return '';
  return parts
    .map(part => typeof part.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function formatAIDetails(details: Record<string, string | undefined>): string {
  const parts = Object.entries(details)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}=${value}`);

  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function isReasoningModel(model: string): boolean {
  const m = model.toLowerCase();
  return m.startsWith('gpt-5') || m.includes('deepseek-v4') || m.includes('deepseek-r');
}

function getOpenAIChatCompletionOptions(model: string, options: AIRequestOptions): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (isReasoningModel(model)) {
    result.max_completion_tokens = options.maxCompletionTokens ?? 4096;
    result.reasoning_effort = 'max';
    result.thinking = { type: 'enabled' };
  }

  if (options.responseType === 'json') {
    result.response_format = { type: 'json_object' };
  }

  return result;
}

async function callGemini(prompt: string, apiKey: string, options: AIRequestOptions = {}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          ...(options.responseType === 'json' ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
      promptFeedback?: {
        blockReason?: string;
      };
    };

    const candidate = data.candidates?.[0];
    const text = extractTextParts(candidate?.content?.parts);
    if (text) return text;

    throw new Error(`Gemini returned no text content${formatAIDetails({
      finishReason: candidate?.finishReason,
      blockReason: data.promptFeedback?.blockReason,
    })}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('abort')) {
      throw new Error(`Gemini request timed out after ${AI_REQUEST_TIMEOUT_MS / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    await sleep(AI_REQUEST_DELAY_MS);
  }
}

async function callOpenAICompatible(
  prompt: string,
  apiKey: string,
  apiBase: string,
  model: string,
  options: AIRequestOptions = {}
): Promise<string> {
  const normalizedBase = apiBase.replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizedBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        ...(isReasoningModel(model) ? {} : { temperature: 0.3, top_p: 0.8 }),
        ...getOpenAIChatCompletionOptions(model, options),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenAI-compatible API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{
        finish_reason?: string;
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
          reasoning_content?: string;
          refusal?: string;
        };
      }>;
    };

    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content === 'string' && content.trim()) return content;
    if (Array.isArray(content)) {
      const text = extractTextParts(content);
      if (text) return text;
    }

    throw new Error(`OpenAI-compatible API returned no text content${formatAIDetails({
      finishReason: choice?.finish_reason,
      refusal: choice?.message?.refusal,
    })}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('abort')) {
      throw new Error(`OpenAI-compatible request timed out after ${AI_REQUEST_TIMEOUT_MS / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    await sleep(AI_REQUEST_DELAY_MS);
  }
}

export function inferOpenAIModel(apiBase: string): string {
  const base = apiBase.toLowerCase();
  if (base.includes('deepseek')) return 'deepseek-v4-pro';
  return OPENAI_DEFAULT_MODEL;
}

export function createAIClient(config: {
  geminiApiKey?: string;
  openaiApiKey?: string;
  openaiApiBase?: string;
  openaiModel?: string;
}): AIClient {
  const state = {
    geminiApiKey: config.geminiApiKey?.trim() || '',
    openaiApiKey: config.openaiApiKey?.trim() || '',
    openaiApiBase: (config.openaiApiBase?.trim() || OPENAI_DEFAULT_API_BASE).replace(/\/+$/, ''),
    openaiModel: config.openaiModel?.trim() || '',
    geminiEnabled: Boolean(config.geminiApiKey?.trim()),
    fallbackLogged: false,
  };

  if (!state.openaiModel) {
    state.openaiModel = inferOpenAIModel(state.openaiApiBase);
  }

  return {
    async call(prompt: string, options: AIRequestOptions = {}): Promise<string> {
      if (state.geminiEnabled && state.geminiApiKey) {
        try {
          return await callGemini(prompt, state.geminiApiKey, options);
        } catch (error) {
          if (state.openaiApiKey) {
            if (!state.fallbackLogged) {
              const reason = error instanceof Error ? error.message : String(error);
              console.warn(`[digest] Gemini failed, switching to OpenAI-compatible fallback (${state.openaiApiBase}, model=${state.openaiModel}). Reason: ${reason}`);
              state.fallbackLogged = true;
            }
            state.geminiEnabled = false;
            return callOpenAICompatible(prompt, state.openaiApiKey, state.openaiApiBase, state.openaiModel, options);
          }
          throw error;
        }
      }

      if (state.openaiApiKey) {
        return callOpenAICompatible(prompt, state.openaiApiKey, state.openaiApiBase, state.openaiModel, options);
      }

      throw new Error('No AI API key configured. Set GEMINI_API_KEY and/or OPENAI_API_KEY.');
    },
  };
}

export function parseJsonResponse<T>(text: string): T {
  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  jsonText = jsonText.trim();

  if (!jsonText) {
    throw new SyntaxError('AI returned empty response body instead of JSON.');
  }

  const candidates = new Set<string>([jsonText]);
  const firstBrace = jsonText.indexOf('{');
  const lastBrace = jsonText.lastIndexOf('}');
  const firstBracket = jsonText.indexOf('[');
  const lastBracket = jsonText.lastIndexOf(']');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.add(jsonText.slice(firstBrace, lastBrace + 1));
  }
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    candidates.add(jsonText.slice(firstBracket, lastBracket + 1));
  }

  const truncateAt = Math.max(lastBrace, lastBracket);
  if (truncateAt > 10 && truncateAt + 1 < jsonText.length) {
    candidates.add(jsonText.slice(0, truncateAt + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next candidate.
    }
  }

  throw new SyntaxError(`Invalid JSON (truncated or malformed response): ${jsonText.slice(0, 200)}`);
}

function isRetryableAIOutputError(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  if (!(error instanceof Error)) return false;

  return /no text content|empty response body|returned no results array|returned \d+ results for \d+ requested articles|non-integer batch index|out-of-range batch index|duplicate batch index/i.test(error.message);
}

export async function callJsonWithRetry<T>(
  aiClient: AIClient,
  prompt: string,
  taskLabel: string,
  options: AIRequestOptions = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= AI_JSON_MAX_ATTEMPTS; attempt++) {
    const attemptPrompt = attempt === 1
      ? prompt
      : `${prompt}\n\n再次提醒：只返回一个合法 JSON 对象，不要输出解释、代码块或省略内容。`;

    try {
      const responseText = await aiClient.call(attemptPrompt, {
        responseType: 'json',
        maxCompletionTokens: options.maxCompletionTokens,
      });
      return parseJsonResponse<T>(responseText);
    } catch (error) {
      lastError = error;
      if (attempt < AI_JSON_MAX_ATTEMPTS && isRetryableAIOutputError(error)) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[digest] ${taskLabel}: retrying after unusable AI output (${reason})`);
        continue;
      }
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
