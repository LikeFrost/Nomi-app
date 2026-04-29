import Anthropic from '@anthropic-ai/sdk';
import { Platform } from 'react-native';
import type { AIInput, AIOutput } from './types';
import { SYSTEM_PROMPT, buildUserMessage, parseAndValidate } from './prompt';

const llmBaseUrl = process.env.EXPO_PUBLIC_LLM_BASE_URL;
const llmAuthToken = process.env.EXPO_PUBLIC_LLM_AUTH_TOKEN;
const llmModel = process.env.EXPO_PUBLIC_LLM_MODEL;

// On web, browsers block direct cross-origin calls to the LLM proxy. Route
// through the Expo dev server (see metro.config.js), which forwards to the
// upstream and adds CORS headers. Native platforms hit the upstream directly.
const baseURL =
  Platform.OS === 'web'
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api-proxy`
    : llmBaseUrl;

const client = new Anthropic({
  baseURL,
  authToken: llmAuthToken,
  apiKey: llmAuthToken,
  dangerouslyAllowBrowser: true,
});

const MODEL = llmModel ?? 'claude-haiku-4-5';
const TIMEOUT_MS = 1500;

export async function callLLM(input: AIInput, signal?: AbortSignal): Promise<AIOutput | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 256,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: buildUserMessage(input) }],
      },
      { signal: controller.signal },
    );

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;
    return parseAndValidate(textBlock.text);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
