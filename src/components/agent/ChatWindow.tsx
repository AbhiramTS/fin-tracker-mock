import { useEffect, useRef, useState } from 'react';
import { Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAgentChat } from '@/context/AgentContext';
import { ChatMessageBubble, StreamingBubble } from './ChatMessage';
import { EntityPreviewCard } from './EntityPreviewCard';

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
	const {
		currentSession,
		isStreaming,
		streamingContent,
		sendMessage,
		savePreview,
		dismissPreview,
	} = useAgentChat();

	const [input, setInput] = useState('');
	const bottomRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const messages = currentSession?.messages ?? [];

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

	return (
		<div className={cn('flex flex-col', className)}>
			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
				{messages.length === 0 && !isStreaming && <EmptyState />}

				{messages.map((msg) => (
					<div key={msg.id}>
						<ChatMessageBubble message={msg} />
						{msg.role === 'assistant' && msg.preview && (
							<EntityPreviewCard
								messageId={msg.id}
								preview={msg.preview}
								onSave={savePreview}
								onDismiss={dismissPreview}
							/>
						)}
					</div>
				))}

				{isStreaming && <StreamingBubble content={streamingContent} />}

				<div ref={bottomRef} />
			</div>

			{/* Input bar */}
			<div className="shrink-0 border-t border-border px-3 py-2.5">
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
