/**
 * LLM transport layer using Vercel AI SDK.
 * Supports OpenAI-compatible endpoints and Gemini.
 */
import { streamText, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { CoreMessage } from 'ai';
import type { AgentConfig } from './types';

export type { CoreMessage };

const AGENT_MAX_OUTPUT_TOKENS = 900;

function getProvider(config: AgentConfig): 'openai-compatible' | 'gemini' {
	return config.provider ?? 'openai-compatible';
}

function createOpenAIModel(config: AgentConfig) {
	const provider = createOpenAI({
		baseURL: config.baseUrl?.trim() || 'https://api.openai.com/v1',
		apiKey: config.apiKey,
		// 'compatible' mode works with any OpenAI-compatible endpoint
		// (OpenAI, Ollama, LM Studio, Groq, Together AI, Fireworks, etc.)
		compatibility: 'compatible',
	});
	return provider(config.model);
}

function createGeminiModel(config: AgentConfig) {
	const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
	return google(config.model);
}

/**
 * Stream a response from the configured LLM.
 * Calls onChunk with the FULL accumulated text on each delta.
 * Returns the complete text when done.
 */
export async function streamAgentResponse(
	messages: CoreMessage[],
	config: AgentConfig,
	onChunk: (accumulatedText: string) => void,
	signal?: AbortSignal
): Promise<string> {
	const result = streamText({
		model:
			getProvider(config) === 'gemini'
				? createGeminiModel(config)
				: createOpenAIModel(config),
		messages,
		maxTokens: AGENT_MAX_OUTPUT_TOKENS,
		abortSignal: signal,
	});

	let fullText = '';
	for await (const chunk of result.textStream) {
		fullText += chunk;
		onChunk(fullText);
	}
	return fullText;
}

/**
 * Test connectivity — sends a minimal prompt and returns the response.
 * Throws on error (network, auth, model not found, etc.).
 */
export async function testAgentConnection(config: AgentConfig): Promise<string> {
	const result = await generateText({
		model:
			getProvider(config) === 'gemini'
				? createGeminiModel(config)
				: createOpenAIModel(config),
		prompt: 'Respond with exactly: "Connection OK"',
		maxTokens: 10,
	});
	return result.text.trim();
}
