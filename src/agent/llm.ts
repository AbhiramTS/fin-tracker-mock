/**
 * LLM transport layer using Vercel AI SDK.
 * Uses @ai-sdk/openai provider — compatible with any OpenAI-compatible endpoint.
 */
import { streamText, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { CoreMessage } from 'ai';
import type { AgentConfig } from './types';

export type { CoreMessage };

function createProvider(config: AgentConfig) {
	return createOpenAI({
		baseURL: config.baseUrl,
		apiKey: config.apiKey,
		// 'compatible' mode works with any OpenAI-compatible endpoint
		// (Ollama, LM Studio, Groq, Together AI, Fireworks, etc.)
		compatibility: 'compatible',
	});
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
	const provider = createProvider(config);
	const result = streamText({
		model: provider(config.model),
		messages,
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
	const provider = createProvider(config);
	const result = await generateText({
		model: provider(config.model),
		prompt: 'Respond with exactly: "Connection OK"',
		maxTokens: 10,
	});
	return result.text.trim();
}
