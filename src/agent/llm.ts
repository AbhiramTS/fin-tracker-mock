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

const AGENT_MAX_OUTPUT_TOKENS = 1600;

function redactSecrets(input: string): string {
	return input
		.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-api-key]')
		.replace(/\bAIza[0-9A-Za-z_-]{10,}\b/g, '[redacted-api-key]')
		.replace(/\bBearer\s+[A-Za-z0-9._-]{8,}\b/gi, 'Bearer [redacted-token]');
}

function extractStatusCode(text: string): number | null {
	const statusMatch = text.match(/\b(4\d\d|5\d\d)\b/);
	if (!statusMatch) return null;
	const parsed = Number(statusMatch[1]);
	return Number.isFinite(parsed) ? parsed : null;
}

export function getAgentErrorMessage(error: unknown): string {
	if (error instanceof Error && error.name === 'AbortError') {
		return 'Request cancelled.';
	}

	const rawMessage =
		error instanceof Error
			? error.message
			: typeof error === 'string'
				? error
				: 'Unexpected AI provider error.';

	const safeMessage = redactSecrets(rawMessage);
	const lower = safeMessage.toLowerCase();
	const statusCode = extractStatusCode(safeMessage);

	const isAuthLike =
		statusCode === 401 ||
		statusCode === 403 ||
		/unauthoriz|forbidden|invalid api key|invalid key|api key not valid|authentication|auth|token|credential|permission denied/.test(
			lower
		);

	if (isAuthLike) {
		return 'Authentication failed for the AI provider. Your token may be missing, expired, or invalid. Update it in Settings -> AI Agent and try again.';
	}

	const isQuotaLike =
		statusCode === 429 ||
		/quota|rate limit|billing|insufficient_quota|resource exhausted/.test(lower);
	if (isQuotaLike) {
		return 'AI provider quota or billing limit reached. Check your provider plan/limits and try again.';
	}

	return safeMessage || 'Unexpected AI provider error.';
}

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
	try {
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
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') throw error;
		throw new Error(getAgentErrorMessage(error));
	}
}

/**
 * Test connectivity — sends a minimal prompt and returns the response.
 * Throws on error (network, auth, model not found, etc.).
 */
export async function testAgentConnection(config: AgentConfig): Promise<string> {
	try {
		const result = await generateText({
			model:
				getProvider(config) === 'gemini'
					? createGeminiModel(config)
					: createOpenAIModel(config),
			prompt: 'Respond with exactly: "Connection OK"',
			maxTokens: 10,
		});
		return result.text.trim();
	} catch (error) {
		throw new Error(getAgentErrorMessage(error));
	}
}
