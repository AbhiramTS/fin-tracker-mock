import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { useApp } from '@/context/AppContext';
import { useNotifications } from '@/context/NotificationContext';
import { calculateEMI } from '@/utils/amortisation';
import { generateId } from '@/utils/id';
import {
	deleteAgentSession,
	getAgentSession,
	listAgentSessions,
	saveAgentSession,
} from '@/agent/db';
import { streamAgentResponse } from '@/agent/llm';
import { buildMessages, buildSystemPrompt } from '@/agent/prompt';
import { parseAgentResponse, resolveAccountId } from '@/agent/parse';
import type {
	AgentConfig,
	ChatMessage,
	ChatSession,
	ChatSessionSummary,
	EntityPreview,
	SaveStatus,
} from '@/agent/types';

// ── localStorage helpers ──────────────────────────────────────────────────────
const CONFIG_KEY = 'ft_agent_config';

export function loadAgentConfig(): AgentConfig | null {
	try {
		const raw = localStorage.getItem(CONFIG_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as AgentConfig;
	} catch {
		return null;
	}
}

export function persistAgentConfig(config: AgentConfig): void {
	localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearAgentConfig(): void {
	localStorage.removeItem(CONFIG_KEY);
}

// ── Context interface ─────────────────────────────────────────────────────────
interface AgentContextValue {
	config: AgentConfig | null;
	saveConfig: (cfg: AgentConfig) => void;
	removeConfig: () => void;

	sessions: ChatSessionSummary[];
	currentSession: ChatSession | null;
	startNewSession: () => void;
	loadSession: (id: string) => Promise<void>;
	deleteSession: (id: string) => Promise<void>;

	isStreaming: boolean;
	streamingContent: string;
	sendMessage: (content: string) => Promise<void>;
	stopStreaming: () => void;

	savePreview: (messageId: string) => Promise<void>;
	dismissPreview: (messageId: string) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AgentProvider({ children }: { children: ReactNode }) {
	const { state: appState, save } = useApp();
	const { notify } = useNotifications();

	const [config, setConfig] = useState<AgentConfig | null>(() => loadAgentConfig());
	const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
	const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
	const [isStreaming, setIsStreaming] = useState(false);
	const [streamingContent, setStreamingContent] = useState('');
	const abortRef = useRef<AbortController | null>(null);

	// Load session summaries on mount
	useEffect(() => {
		listAgentSessions().then(setSessions).catch(console.error);
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	const saveConfig = useCallback((cfg: AgentConfig) => {
		persistAgentConfig(cfg);
		setConfig(cfg);
	}, []);

	const removeConfig = useCallback(() => {
		clearAgentConfig();
		setConfig(null);
	}, []);

	const startNewSession = useCallback(() => {
		const now = new Date().toISOString();
		const session: ChatSession = {
			id: generateId(),
			title: '',
			messages: [],
			createdAt: now,
			updatedAt: now,
		};
		setCurrentSession(session);
	}, []);

	const loadSession = useCallback(async (id: string) => {
		const session = await getAgentSession(id);
		if (session) setCurrentSession(session);
	}, []);

	const deleteSession = useCallback(
		async (id: string) => {
			await deleteAgentSession(id);
			setSessions((prev) => prev.filter((s) => s.id !== id));
			if (currentSession?.id === id) setCurrentSession(null);
		},
		[currentSession]
	);

	// ── Helpers for updating a message's preview in the current session ───────
	const updateMessagePreview = useCallback(
		(messageId: string, updates: Partial<EntityPreview>) => {
			setCurrentSession((prev) => {
				if (!prev) return prev;
				const messages = prev.messages.map((m) =>
					m.id === messageId && m.preview
						? { ...m, preview: { ...m.preview, ...updates } }
						: m
				);
				return { ...prev, messages };
			});
		},
		[]
	);

	const persistSession = useCallback(async (session: ChatSession) => {
		await saveAgentSession(session);
		setSessions((prev) => {
			const summary: ChatSessionSummary = {
				id: session.id,
				title: session.title,
				messageCount: session.messages.length,
				createdAt: session.createdAt,
				updatedAt: session.updatedAt,
			};
			const exists = prev.findIndex((s) => s.id === session.id);
			if (exists >= 0) {
				const updated = [...prev];
				updated[exists] = summary;
				return updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
			}
			return [summary, ...prev];
		});
	}, []);

	// ── Send a user message and stream the response ───────────────────────────
	const sendMessage = useCallback(
		async (content: string) => {
			if (!content.trim() || isStreaming) return;

			const session =
				currentSession ??
				(() => {
					const now = new Date().toISOString();
					return {
						id: generateId(),
						title: '',
						messages: [],
						createdAt: now,
						updatedAt: now,
					} satisfies ChatSession;
				})();

			// Add user message
			const userMsg: ChatMessage = {
				id: generateId(),
				role: 'user',
				content: content.trim(),
				timestamp: new Date().toISOString(),
			};

			const title =
				session.title || content.trim().slice(0, 50) + (content.length > 50 ? '…' : '');

			const sessionWithUser: ChatSession = {
				...session,
				title,
				messages: [...session.messages, userMsg],
				updatedAt: new Date().toISOString(),
			};
			setCurrentSession(sessionWithUser);

			// Guard: no config
			if (!config?.baseUrl || !config?.apiKey || !config?.model) {
				const warnMsg: ChatMessage = {
					id: generateId(),
					role: 'assistant',
					content:
						'⚙️ AI Agent is not configured yet. Please go to **Settings → AI Agent** and enter your API endpoint, API key, and model name.',
					timestamp: new Date().toISOString(),
				};
				const warnSession: ChatSession = {
					...sessionWithUser,
					messages: [...sessionWithUser.messages, warnMsg],
					updatedAt: new Date().toISOString(),
				};
				setCurrentSession(warnSession);
				await persistSession(warnSession);
				return;
			}

			setIsStreaming(true);
			setStreamingContent('');

			try {
				const systemPrompt = buildSystemPrompt(appState);
				const history = sessionWithUser.messages.map((m) => ({
					role: m.role,
					content: m.content,
				}));
				const coreMessages = buildMessages(systemPrompt, history);

				abortRef.current = new AbortController();

				const fullText = await streamAgentResponse(
					coreMessages,
					config,
					setStreamingContent,
					abortRef.current.signal
				);

				const parsed = parseAgentResponse(fullText, appState);

				const assistantMsg: ChatMessage = {
					id: generateId(),
					role: 'assistant',
					content: fullText,
					timestamp: new Date().toISOString(),
					preview: parsed
						? {
								entities: parsed.entities,
								summary: parsed.summary,
								saveStatus: 'pending',
							}
						: undefined,
				};

				const finalSession: ChatSession = {
					...sessionWithUser,
					messages: [...sessionWithUser.messages, assistantMsg],
					updatedAt: new Date().toISOString(),
				};
				setCurrentSession(finalSession);
				await persistSession(finalSession);
			} catch (error) {
				const err = error as Error;
				if (err.name === 'AbortError') return;

				const errMsg: ChatMessage = {
					id: generateId(),
					role: 'assistant',
					content: `⚠️ Request failed: ${err.message}. Check your AI Agent settings and try again.`,
					timestamp: new Date().toISOString(),
				};
				const errSession: ChatSession = {
					...sessionWithUser,
					messages: [...sessionWithUser.messages, errMsg],
					updatedAt: new Date().toISOString(),
				};
				setCurrentSession(errSession);
				await persistSession(errSession);
			} finally {
				setIsStreaming(false);
				setStreamingContent('');
				abortRef.current = null;
			}
		},
		[config, currentSession, isStreaming, appState, persistSession]
	);

	const stopStreaming = useCallback(() => {
		abortRef.current?.abort();
	}, []);

	// ── Save preview entities ─────────────────────────────────────────────────
	const savePreview = useCallback(
		async (messageId: string) => {
			if (!currentSession) return;
			const message = currentSession.messages.find((m) => m.id === messageId);
			if (!message?.preview) return;

			updateMessagePreview(messageId, { saveStatus: 'saving' as SaveStatus });

			try {
				const { entities } = message.preview;
				let savedCount = 0;

				// Journal entries (IDs already resolved by parse.ts)
				for (const je of entities.journalEntries ?? []) {
					await save('journalEntries', je as unknown as Record<string, unknown>);
					savedCount++;
				}

				// Accounts
				for (const acc of entities.accounts ?? []) {
					await save('accounts', acc as unknown as Record<string, unknown>);
					savedCount++;
				}

				// Loans — resolve account name → ID, calculate EMI if missing
				for (const loan of entities.loans ?? []) {
					const accountId = resolveAccountId(loan.account, appState);
					const emi =
						loan.emi ??
						calculateEMI(
							loan.principalAmount,
							loan.interestRate,
							loan.tenureMonths
						);
					const { account: _account, ...loanData } = loan;
					void _account;
					await save('loans', {
						...loanData,
						accountId,
						emi,
						loanType: loan.loanType ?? 'normal',
						paidMonths: loan.paidMonths ?? 0,
					} as Record<string, unknown>);
					savedCount++;
				}

				// Investments — resolve account name → ID
				for (const inv of entities.investments ?? []) {
					const accountId = resolveAccountId(inv.accountName, appState);
					const { accountName: _an, ...invData } = inv;
					void _an;
					await save('investments', {
						...invData,
						...(accountId ? { accountId } : {}),
					} as Record<string, unknown>);
					savedCount++;
				}

				// Goals
				for (const goal of entities.goals ?? []) {
					await save('goals', goal as unknown as Record<string, unknown>);
					savedCount++;
				}

				// Receivables — resolve account name → ID
				for (const rec of entities.receivables ?? []) {
					const accountId = resolveAccountId(rec.accountName, appState) ?? '';
					const { accountName: _an, ...recData } = rec;
					void _an;
					await save('receivables', {
						...recData,
						accountId,
					} as Record<string, unknown>);
					savedCount++;
				}

				// Recurring payments — resolve account name → ID
				for (const rp of entities.recurringPayments ?? []) {
					const accountId = resolveAccountId(rp.accountName, appState) ?? '';
					const { accountName: _an, ...rpData } = rp;
					void _an;
					await save('recurringPayments', {
						...rpData,
						accountId,
						isActive: rp.isActive ?? true,
					} as Record<string, unknown>);
					savedCount++;
				}

				// Recurring incomes — resolve account name → ID
				for (const ri of entities.recurringIncomes ?? []) {
					const accountId = resolveAccountId(ri.accountName, appState) ?? '';
					const { accountName: _an, ...riData } = ri;
					void _an;
					await save('recurringIncomes', {
						...riData,
						accountId,
						isActive: ri.isActive ?? true,
					} as Record<string, unknown>);
					savedCount++;
				}

				updateMessagePreview(messageId, { saveStatus: 'saved' as SaveStatus });

				// Persist updated session
				setCurrentSession((prev) => {
					if (!prev) return prev;
					const updated: ChatSession = {
						...prev,
						messages: prev.messages.map((m) =>
							m.id === messageId && m.preview
								? { ...m, preview: { ...m.preview, saveStatus: 'saved' as SaveStatus } }
								: m
						),
					};
					persistSession(updated).catch(console.error);
					return updated;
				});

				notify({
					title: `${savedCount} ${savedCount === 1 ? 'item' : 'items'} saved`,
					description: message.preview.summary,
					tone: 'success',
				});
			} catch (e) {
				const errMsg = (e as Error).message;
				updateMessagePreview(messageId, {
					saveStatus: 'pending' as SaveStatus,
					errorMessage: errMsg,
				});
				notify({ title: 'Save failed', description: errMsg, tone: 'error' });
			}
		},
		[currentSession, appState, save, notify, updateMessagePreview, persistSession]
	);

	const dismissPreview = useCallback(
		(messageId: string) => {
			updateMessagePreview(messageId, { saveStatus: 'dismissed' as SaveStatus });
			// Persist
			setCurrentSession((prev) => {
				if (!prev) return prev;
				const updated: ChatSession = {
					...prev,
					messages: prev.messages.map((m) =>
						m.id === messageId && m.preview
							? { ...m, preview: { ...m.preview, saveStatus: 'dismissed' as SaveStatus } }
							: m
					),
				};
				persistSession(updated).catch(console.error);
				return updated;
			});
		},
		[updateMessagePreview, persistSession]
	);

	return (
		<AgentContext.Provider
			value={{
				config,
				saveConfig,
				removeConfig,
				sessions,
				currentSession,
				startNewSession,
				loadSession,
				deleteSession,
				isStreaming,
				streamingContent,
				sendMessage,
				stopStreaming,
				savePreview,
				dismissPreview,
			}}>
			{children}
		</AgentContext.Provider>
	);
}

export function useAgentChat(): AgentContextValue {
	const ctx = useContext(AgentContext);
	if (!ctx) throw new Error('useAgentChat must be used inside AgentProvider');
	return ctx;
}
