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
import { getAgentErrorMessage, streamAgentResponse } from '@/agent/llm';
import { buildMessages, buildSystemPrompt } from '@/agent/prompt';
import { buildRealtimeQueryContext } from '@/agent/dataQuery';
import { parseAgentResponse, resolveAccountId } from '@/agent/parse';
import type {
	AgentConfig,
	ChatMessage,
	ChatSession,
	ChatSessionSummary,
	EntityPreview,
	ParsedEntities,
	SaveStatus,
} from '@/agent/types';

function detectMissingDataPoints(entities: ParsedEntities): string[] {
	const missing: string[] = [];

	for (const [index, je] of (entities.journalEntries ?? []).entries()) {
		if (!je.description?.trim()) missing.push(`Journal entry ${index + 1}: description`);
		if (!(je.amount > 0)) missing.push(`Journal entry ${index + 1}: amount`);
		if (!je.date?.trim()) missing.push(`Journal entry ${index + 1}: date`);
		if (!je.debitAccountHeadId?.trim()) {
			missing.push(`Journal entry ${index + 1}: debit account`);
		}
		if (!je.creditAccountHeadId?.trim()) {
			missing.push(`Journal entry ${index + 1}: credit account`);
		}
	}

	for (const [index, acc] of (entities.accounts ?? []).entries()) {
		if (!acc.name?.trim()) missing.push(`Account ${index + 1}: name`);
		if (!acc.type?.trim()) missing.push(`Account ${index + 1}: type`);
		if (acc.type === 'credit_card') {
			if (acc.creditLimit === undefined) {
				missing.push(`Credit card ${index + 1}: credit limit`);
			}
			if (acc.statementDay === undefined) {
				missing.push(`Credit card ${index + 1}: statement day`);
			}
			if (!acc.dueDate?.trim()) missing.push(`Credit card ${index + 1}: due date`);
		}
	}

	for (const [index, loan] of (entities.loans ?? []).entries()) {
		if (!loan.name?.trim()) missing.push(`Loan ${index + 1}: name`);
		if (!(loan.principalAmount > 0)) missing.push(`Loan ${index + 1}: principal amount`);
		if (!(loan.interestRate > 0)) missing.push(`Loan ${index + 1}: interest rate`);
		if (!(loan.tenureMonths > 0)) missing.push(`Loan ${index + 1}: tenure`);
		if (!loan.startDate?.trim()) missing.push(`Loan ${index + 1}: start date`);
	}

	for (const [index, inv] of (entities.investments ?? []).entries()) {
		if (!inv.name?.trim()) missing.push(`Investment ${index + 1}: name`);
		if (!inv.type?.trim()) missing.push(`Investment ${index + 1}: type`);
		if (!(inv.value > 0)) missing.push(`Investment ${index + 1}: value`);
	}

	for (const [index, goal] of (entities.goals ?? []).entries()) {
		if (!goal.name?.trim()) missing.push(`Goal ${index + 1}: name`);
		if (!(goal.targetAmount > 0)) missing.push(`Goal ${index + 1}: target amount`);
	}

	for (const [index, rec] of (entities.receivables ?? []).entries()) {
		if (!rec.personName?.trim()) missing.push(`Receivable ${index + 1}: person name`);
		if (!(rec.amountLent > 0)) missing.push(`Receivable ${index + 1}: amount`);
		if (!rec.dateLent?.trim()) missing.push(`Receivable ${index + 1}: date`);
	}

	for (const [index, rp] of (entities.recurringPayments ?? []).entries()) {
		if (!rp.name?.trim()) missing.push(`Recurring payment ${index + 1}: name`);
		if (!(rp.amount > 0)) missing.push(`Recurring payment ${index + 1}: amount`);
		if (!rp.frequency?.trim()) missing.push(`Recurring payment ${index + 1}: frequency`);
		if (!rp.nextDate?.trim()) missing.push(`Recurring payment ${index + 1}: next date`);
		if (!rp.category?.trim()) missing.push(`Recurring payment ${index + 1}: category`);
	}

	for (const [index, ri] of (entities.recurringIncomes ?? []).entries()) {
		if (!ri.name?.trim()) missing.push(`Recurring income ${index + 1}: name`);
		if (!(ri.amount > 0)) missing.push(`Recurring income ${index + 1}: amount`);
		if (!ri.frequency?.trim()) missing.push(`Recurring income ${index + 1}: frequency`);
		if (!ri.nextDate?.trim()) missing.push(`Recurring income ${index + 1}: next date`);
	}

	return missing;
}

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
	deferPreview: (messageId: string) => void;
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
			const provider = config?.provider ?? 'openai-compatible';
			const missingBaseUrl = provider === 'openai-compatible' && !config?.baseUrl?.trim();
			if (!config?.apiKey || !config?.model || missingBaseUrl) {
				const warnMsg: ChatMessage = {
					id: generateId(),
					role: 'assistant',
					content: missingBaseUrl
						? '⚙️ AI Agent is not configured yet. Please go to **Settings → AI Agent** and set the provider base URL, API key, and model name.'
						: '⚙️ AI Agent is not configured yet. Please go to **Settings → AI Agent** and set the API key and model name.',
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
				const basePrompt = buildSystemPrompt(appState);
				const queryContext = buildRealtimeQueryContext(content, appState);
				const systemPrompt = `${basePrompt}\n\n${queryContext}`;
				const history = sessionWithUser.messages.map((m) => ({
					role: m.role,
					content: m.content,
				}));
				const coreMessages = buildMessages(systemPrompt, history);

				abortRef.current = new AbortController();

				let fullText = await streamAgentResponse(
					coreMessages,
					config,
					setStreamingContent,
					abortRef.current.signal
				);

				let parsed = parseAgentResponse(fullText, appState);
				const hasOpenJsonFence = /```(?:json)?\s*/i.test(fullText);
				const hasClosedJsonFence = /```(?:json)?\s*[\s\S]*```/i.test(fullText);

				// If the model started JSON but got cut off, ask it to continue once.
				if (!parsed && hasOpenJsonFence && !hasClosedJsonFence) {
					const continuationMessages = [
						...coreMessages,
						{ role: 'assistant', content: fullText },
						{
							role: 'user',
							content:
								'Your previous response was truncated. Continue exactly where you stopped and finish the same fenced JSON block. Do not restart from the beginning.',
						},
					] as const;

					const continuation = await streamAgentResponse(
						continuationMessages,
						config,
						(deltaText) => setStreamingContent(`${fullText}${deltaText}`),
						abortRef.current.signal
					);

					fullText = `${fullText}${continuation}`;
					parsed = parseAgentResponse(fullText, appState);
				}

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
								missingDataPoints: detectMissingDataPoints(parsed.entities),
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
				if (error instanceof Error && error.name === 'AbortError') return;
				const message = getAgentErrorMessage(error);

				const errMsg: ChatMessage = {
					id: generateId(),
					role: 'assistant',
					content: `⚠️ ${message}`,
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

			const missingDataPoints = detectMissingDataPoints(message.preview.entities);
			if (missingDataPoints.length > 0) {
				updateMessagePreview(messageId, {
					saveStatus: 'pending' as SaveStatus,
					missingDataPoints,
					errorMessage:
						'Missing data points found. You can enter details now or do it later.',
				});
				notify({
					title: 'More details needed',
					description: 'Please add missing fields now or choose to do it later.',
					tone: 'warning',
				});
				return;
			}

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
					const {
						creditLimit,
						outstanding,
						statementDay,
						billingCycleDays,
						gracePeriodDays,
						dueDate,
						statementDate,
						taxRate,
						...baseAcc
					} = acc as typeof acc & {
						creditLimit?: number;
						outstanding?: number;
						statementDay?: number;
						billingCycleDays?: number;
						gracePeriodDays?: number;
						dueDate?: string;
						statementDate?: string;
						taxRate?: number;
					};
					const existingAccount = appState.accounts.find(
						(a) =>
							a.name.toLowerCase() === (acc.name ?? '').toLowerCase() &&
							a.type === acc.type
					);
					const today = new Date().toISOString().slice(0, 10);
					const creditCardDetails =
						acc.type === 'credit_card'
							? {
									limit: creditLimit ?? 0,
									outstanding: outstanding ?? 0,
									statementDay: statementDay ?? 1,
									billingCycleDays: billingCycleDays ?? 30,
									gracePeriodDays: gracePeriodDays ?? 20,
									dueDate: dueDate ?? today,
									statementDate: statementDate ?? today,
									...(taxRate !== undefined ? { taxRate } : {}),
								}
							: undefined;
					await save('accounts', {
						...baseAcc,
						...(existingAccount ? { id: existingAccount.id } : {}),
						...(creditCardDetails ? { creditCard: creditCardDetails } : {}),
					} as unknown as Record<string, unknown>);
					savedCount++;
				}

				// Loans — resolve account name → ID, calculate EMI if missing
				for (const loan of entities.loans ?? []) {
					const accountId = resolveAccountId(loan.account, appState);
					const emi =
						loan.emi ??
						calculateEMI(loan.principalAmount, loan.interestRate, loan.tenureMonths);
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
								? {
										...m,
										preview: {
											...m.preview,
											saveStatus: 'saved' as SaveStatus,
										},
									}
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
							? {
									...m,
									preview: {
										...m.preview,
										saveStatus: 'dismissed' as SaveStatus,
									},
								}
							: m
					),
				};
				persistSession(updated).catch(console.error);
				return updated;
			});
		},
		[updateMessagePreview, persistSession]
	);

	const deferPreview = useCallback(
		(messageId: string) => {
			updateMessagePreview(messageId, {
				saveStatus: 'deferred' as SaveStatus,
				errorMessage: undefined,
			});
			setCurrentSession((prev) => {
				if (!prev) return prev;
				const updated: ChatSession = {
					...prev,
					messages: prev.messages.map((m) =>
						m.id === messageId && m.preview
							? {
									...m,
									preview: {
										...m.preview,
										saveStatus: 'deferred' as SaveStatus,
										errorMessage: undefined,
									},
							  }
							: m
					),
				};
				persistSession(updated).catch(console.error);
				return updated;
			});
			notify({
				title: 'Saved for later',
				description: 'You can complete this preview from this chat anytime.',
				tone: 'default',
			});
		},
		[updateMessagePreview, persistSession, notify]
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
				deferPreview,
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
