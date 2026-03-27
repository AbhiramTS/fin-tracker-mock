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

export interface AgentErrorInfo {
	kind: 'abort' | 'auth' | 'rate-limit' | 'network' | 'unknown';
	message: string;
	statusCode?: number;
	retryAfterSeconds?: number;
}

function redactSecrets(input: string): string {
	return input
		.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-api-key]')
		.replace(/\bAIza[0-9A-Za-z_-]{10,}\b/g, '[redacted-api-key]')
		.replace(/\bBearer\s+[A-Za-z0-9._-]{8,}\b/gi, 'Bearer [redacted-token]');
}

function extractStatusCodeFromText(text: string): number | null {
	const statusMatch = text.match(/\b(4\d\d|5\d\d)\b/);
	if (!statusMatch) return null;
	const parsed = Number(statusMatch[1]);
	return Number.isFinite(parsed) ? parsed : null;
}

function readObjectValue(source: unknown, key: string): unknown {
	if (!source || typeof source !== 'object') return undefined;
	return (source as Record<string, unknown>)[key];
}

function extractStatusCode(error: unknown): number | null {
	const statusCandidates = [
		readObjectValue(error, 'statusCode'),
		readObjectValue(error, 'status'),
		readObjectValue(readObjectValue(error, 'response'), 'status'),
		readObjectValue(readObjectValue(error, 'cause'), 'statusCode'),
		readObjectValue(readObjectValue(error, 'cause'), 'status'),
	];

	for (const candidate of statusCandidates) {
		const parsed = Number(candidate);
		if (Number.isFinite(parsed) && parsed >= 400 && parsed <= 599) {
			return parsed;
		}
	}

	const rawMessage = extractRawMessage(error);
	return rawMessage ? extractStatusCodeFromText(rawMessage) : null;
}

function readHeaderValue(headers: unknown, key: string): string | null {
	if (!headers) return null;
	if (headers instanceof Headers) {
		return headers.get(key);
	}
	if (typeof headers === 'object') {
		const record = headers as Record<string, unknown>;
		const direct = record[key] ?? record[key.toLowerCase()] ?? record[key.toUpperCase()];
		return typeof direct === 'string' ? direct : null;
	}
	return null;
}

function extractRetryAfterSeconds(error: unknown): number | null {
	const headersCandidates = [
		readObjectValue(error, 'headers'),
		readObjectValue(error, 'responseHeaders'),
		readObjectValue(readObjectValue(error, 'response'), 'headers'),
		readObjectValue(readObjectValue(error, 'cause'), 'headers'),
	];

	for (const headers of headersCandidates) {
		const raw = readHeaderValue(headers, 'retry-after');
		if (!raw) continue;
		const seconds = Number(raw);
		if (Number.isFinite(seconds) && seconds > 0) return seconds;
		const retryDate = Date.parse(raw);
		if (!Number.isNaN(retryDate)) {
			const deltaSeconds = Math.ceil((retryDate - Date.now()) / 1000);
			if (deltaSeconds > 0) return deltaSeconds;
		}
	}

	return null;
}

function extractRawMessage(error: unknown): string {
	if (error instanceof Error) {
		if (error.message) return error.message;
		if (error.cause) return extractRawMessage(error.cause);
	}

	if (typeof error === 'string') return error;

	if (error && typeof error === 'object') {
		for (const key of ['message', 'error', 'detail', 'details']) {
			const value = readObjectValue(error, key);
			if (typeof value === 'string' && value.trim()) return value;
		}

		const cause = readObjectValue(error, 'cause');
		if (cause) {
			const causeMessage = extractRawMessage(cause);
			if (causeMessage.trim()) return causeMessage;
		}
	}

	return 'Unexpected AI provider error.';
}

function formatRetryDelay(seconds: number): string {
	if (seconds < 60) return `about ${seconds}s`;
	const minutes = Math.ceil(seconds / 60);
	return minutes === 1 ? 'about 1 minute' : `about ${minutes} minutes`;
}

export function getAgentErrorInfo(error: unknown): AgentErrorInfo {
	if (error instanceof Error && error.name === 'AbortError') {
		return {
			kind: 'abort',
			message: 'Request cancelled.',
		};
	}

	const rawMessage = extractRawMessage(error);
	const safeMessage = redactSecrets(rawMessage);
	const lower = safeMessage.toLowerCase();
	const statusCode = extractStatusCode(error);
	const retryAfterSeconds = extractRetryAfterSeconds(error) ?? undefined;

	const isAuthLike =
		statusCode === 401 ||
		statusCode === 403 ||
		/unauthoriz|forbidden|invalid api key|invalid key|api key not valid|authentication|auth|token|credential|permission denied/.test(
			lower
		);

	if (isAuthLike) {
		return {
			kind: 'auth',
			statusCode: statusCode ?? undefined,
			message:
				'Authentication failed for the AI provider. Your token may be missing, expired, or invalid. Update it in Settings -> AI Agent and try again.',
		};
	}

	const isQuotaLike =
		statusCode === 429 ||
		/too many requests|quota|rate limit|billing|insufficient_quota|resource exhausted/.test(
			lower
		);
	if (isQuotaLike) {
		return {
			kind: 'rate-limit',
			statusCode: statusCode ?? undefined,
			retryAfterSeconds,
			message: retryAfterSeconds
				? `Rate limit reached for the AI provider. Wait ${formatRetryDelay(retryAfterSeconds)} and send the message again.`
				: 'Rate limit reached for the AI provider. Wait a moment and send the message again. If this keeps happening, check your provider quota or billing limits.',
		};
	}

	const isNetworkLike =
		statusCode === 408 ||
		statusCode === 502 ||
		statusCode === 503 ||
		statusCode === 504 ||
		/failed to fetch|network|timed out|timeout|unavailable|offline|econn|enotfound|socket|connection/.test(
			lower
		);
	if (isNetworkLike) {
		return {
			kind: 'network',
			statusCode: statusCode ?? undefined,
			message:
				'Could not reach the AI provider right now. Check your network connection or provider status and try again.',
		};
	}

	return {
		kind: 'unknown',
		statusCode: statusCode ?? undefined,
		message: safeMessage || 'Unexpected AI provider error.',
	};
}

export function getAgentErrorMessage(error: unknown): string {
	return getAgentErrorInfo(error).message;
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
