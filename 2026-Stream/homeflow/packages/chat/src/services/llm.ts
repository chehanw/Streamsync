/**
 * Multi-provider LLM client using Vercel AI SDK
 * Supports OpenAI, Anthropic (Claude), and Google (Gemini)
 *
 * TODO: Once Firebase backend is set up, move OpenAI calls to a Cloud
 * Function or Cloud Run endpoint and remove client-side API key usage.
 * OpenAI API keys must not live in the client bundle — production
 * deployment requires server-side key storage (Firebase Secret Manager).
 */
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, LanguageModel } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { ChatProvider, DEFAULT_MODELS } from '../types';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

/**
 * Create an AI SDK model instance based on provider configuration
 */
function createModel(provider: ChatProvider): LanguageModel {
  const model = provider.model || DEFAULT_MODELS[provider.type];

  switch (provider.type) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: provider.apiKey,
        fetch: expoFetch as unknown as typeof globalThis.fetch,
      });
      return openai(model);
    }
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: provider.apiKey,
        fetch: expoFetch as unknown as typeof globalThis.fetch,
      });
      return anthropic(model);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey: provider.apiKey,
        fetch: expoFetch as unknown as typeof globalThis.fetch,
      });
      return google(model);
    }
  }
}

/**
 * Stream a chat completion from the configured LLM provider
 */
export async function streamChatCompletion(
  messages: LLMMessage[],
  provider: ChatProvider,
  callbacks: StreamCallbacks,
  abortSignal?: AbortSignal
): Promise<void> {
  try {
    const model = createModel(provider);

    const result = streamText({
      model,
      messages,
      abortSignal,
    });

    let tokenCount = 0;
    for await (const chunk of result.textStream) {
      callbacks.onToken(chunk);
      // Yield to the UI thread periodically so React can paint between tokens.
      // Prevents stalls when expo/fetch delivers chunks in bursts.
      if (++tokenCount % 8 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    callbacks.onComplete();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      callbacks.onComplete();
    } else {
      callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  }
}
