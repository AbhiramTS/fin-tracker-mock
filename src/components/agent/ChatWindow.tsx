import { useEffect, useRef, useState } from 'react';
import { Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAgentChat } from '@/context/AgentContext';
import { useApp } from '@/context/AppContext';
import type { ChatMessage, MissingDataField } from '@/agent/types';
import { ChatMessageBubble, StreamingBubble } from './ChatMessage';
import { EntityPreviewCard } from './EntityPreviewCard';

interface MissingDetailsFormState {
	messageId: string;
	title: string;
	description?: string;
	fields: MissingDataField[];
	values: Record<string, string>;
	hasLinkedPreview: boolean;
	allowDoLater: boolean;
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
			<div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
				<Bot className="h-7 w-7 text-primary/60" />
			</div>
			<div>
				<p className="text-sm font-semibold text-foreground/70">AI Finance Assistant</p>
				<p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
					Ask for budgeting, forecasting, risk checks, product comparisons, or data entry
					in plain language.
				</p>
			</div>
			<div className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-4 py-3 max-w-[280px] space-y-1 text-left">
				<p>💬 "Add salary of ₹85,000 to HDFC savings for March"</p>
				<p>💬 "Build a monthly budget so I can save ₹20,000"</p>
				<p>💬 "Forecast my next 6 months and highlight risk"</p>
				<p>💬 "Netflix subscription ₹649 monthly from ICICI"</p>
				<p>💬 "Lent ₹5,000 to Rahul from cash wallet"</p>
				<p>💬 "Compare two credit cards for my spending pattern"</p>
				<p>💬 "New goal: Emergency fund of ₹3 lakhs"</p>
			</div>
		</div>
	);
}

export function ChatWindow({ className }: { className?: string }) {
	const { state: appState } = useApp();
	const {
		currentSession,
		isStreaming,
		streamingContent,
		sendMessage,
		resendMessage,
		savePreview,
		deferPreview,
		dismissPreview,
	} = useAgentChat();

	const [input, setInput] = useState('');
	const [missingForm, setMissingForm] = useState<MissingDetailsFormState | null>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const messages = currentSession?.messages ?? [];
	const accountOptions = appState.accounts
		.filter((account) => !account.isArchived)
		.map((account) => account.name);

	// Auto-scroll to bottom when messages or streaming content changes
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages.length, streamingContent]);

	const handleSend = async () => {
		const text = input.trim();
		if (!text || isStreaming) return;
		setInput('');
		textareaRef.current?.focus();
		await sendMessage(text);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void handleSend();
		}
	};

	const openMissingDataRequestForm = (
		messageId: string,
		request: NonNullable<ChatMessage['preview']>['missingDataRequest'],
		hasLinkedPreview: boolean
	) => {
		if (!request) return;
		setMissingForm({
			messageId,
			title: request.title,
			description: request.description,
			fields: request.fields,
			values: Object.fromEntries(request.fields.map((field) => [field.key, ''])),
			hasLinkedPreview,
			allowDoLater: request.allowDoLater !== false,
		});
	};

	const handleEnterNow = (messageId: string, missingDataPoints: string[]) => {
		void missingDataPoints;
		const message = messages.find((item) => item.id === messageId);
		if (message?.preview?.missingDataRequest) {
			openMissingDataRequestForm(messageId, message.preview.missingDataRequest, true);
		}
	};

	const handleFormValueChange = (key: string, value: string) => {
		setMissingForm((prev) =>
			prev
				? {
						...prev,
						values: { ...prev.values, [key]: value },
					}
				: prev
		);
	};

	const handleSubmitMissingForm = async () => {
		if (!missingForm) return;

		const lines = missingForm.fields.map((field) => {
			const value = (missingForm.values[field.key] ?? '').trim();
			return `- ${field.label}: ${value || 'Not provided yet'}`;
		});

		setMissingForm(null);
		await sendMessage(`Here are the missing details:\n${lines.join('\n')}`);
	};

	const handleDeferMissingForm = async () => {
		if (!missingForm) return;
		const { messageId, hasLinkedPreview } = missingForm;
		setMissingForm(null);
		if (hasLinkedPreview) {
			deferPreview(messageId);
			return;
		}
		await sendMessage('Do it later');
	};

	const handleQuickChoice = async (message: ChatMessage, choice: 'enter-now' | 'do-later') => {
		if (choice === 'enter-now') {
			if (message.preview?.missingDataRequest) {
				openMissingDataRequestForm(message.id, message.preview.missingDataRequest, true);
			}
			return;
		}

		if (message.preview?.missingDataPoints?.length) {
			deferPreview(message.id);
			return;
		}

		await sendMessage('Do it later');
	};

	const handleRetry = async (message: ChatMessage) => {
		await resendMessage(message.id);
	};

	const shouldShowRetryForMessage = (message: ChatMessage, index: number): boolean => {
		if (message.role !== 'assistant') return false;
		if (message.error?.canRetry) return true;

		const looksLikeError = message.content.trim().startsWith('⚠️');
		if (!looksLikeError) return false;

		// Legacy fallback: if an older error bubble exists, allow retry using the nearest
		// previous user message in the session.
		for (let i = index - 1; i >= 0; i--) {
			if (messages[i]?.role === 'user') return true;
		}

		return false;
	};

	return (
		<div className={cn('flex flex-col', className)}>
			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
				{messages.length === 0 && !isStreaming && <EmptyState />}

				{messages.map((msg, index) => (
					<div key={msg.id}>
						<ChatMessageBubble
							message={msg}
							onQuickChoice={handleQuickChoice}
							onRetry={handleRetry}
							retryDisabled={isStreaming}
							showRetry={shouldShowRetryForMessage(msg, index)}
						/>
						{msg.role === 'assistant' && msg.preview && (
							<EntityPreviewCard
								messageId={msg.id}
								preview={msg.preview}
								onSave={savePreview}
								onDefer={deferPreview}
								onDismiss={dismissPreview}
								onEnterNow={handleEnterNow}
							/>
						)}
					</div>
				))}

				{isStreaming && <StreamingBubble content={streamingContent} />}

				<div ref={bottomRef} />
			</div>

			{/* Input bar */}
			<div className="shrink-0 border-t border-border px-3 py-2.5">
				{missingForm && (
					<div className="mb-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3">
						<p className="text-xs font-semibold text-primary">{missingForm.title}</p>
						{missingForm.description && (
							<p className="mt-1 text-[11px] text-muted-foreground">
								{missingForm.description}
							</p>
						)}
						<div className="mt-2 space-y-2">
							{missingForm.fields.map((field) => (
								<div
									key={field.key}
									className="space-y-1">
									<p className="text-[11px] text-muted-foreground">
										{field.label}
									</p>
									{field.type === 'account' ? (
										<Select
											value={missingForm.values[field.key] ?? ''}
											onValueChange={(value) =>
												handleFormValueChange(field.key, value)
											}>
											<SelectTrigger className="h-8 text-xs">
												<SelectValue placeholder={field.placeholder} />
											</SelectTrigger>
											<SelectContent>
												{accountOptions.map((accountName) => (
													<SelectItem
														key={accountName}
														value={accountName}>
														{accountName}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									) : (
										<Input
											type={field.type}
											value={missingForm.values[field.key] ?? ''}
											onChange={(e) =>
												handleFormValueChange(field.key, e.target.value)
											}
											placeholder={field.placeholder}
											className="h-8 text-xs"
										/>
									)}
								</div>
							))}
						</div>
						<div className="mt-2.5 flex gap-2">
							<Button
								size="sm"
								className="h-7 px-2.5 text-xs"
								onClick={() => void handleSubmitMissingForm()}
								disabled={isStreaming}>
								Submit details
							</Button>
							{missingForm.allowDoLater && (
								<Button
									size="sm"
									variant="ghost"
									className="h-7 px-2.5 text-xs"
									onClick={() => void handleDeferMissingForm()}
									disabled={isStreaming}>
									Do it later
								</Button>
							)}
						</div>
					</div>
				)}

				<div className="flex gap-2 items-end">
					<Textarea
						ref={textareaRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
						rows={1}
						disabled={isStreaming}
						className="resize-none overflow-hidden min-h-[38px] max-h-[120px] text-sm py-2"
					/>
					<Button
						size="icon"
						onClick={() => void handleSend()}
						disabled={!input.trim() || isStreaming}
						className="shrink-0">
						{isStreaming ? (
							<div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
						) : (
							<Send className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
