import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/agent/types';
import { Button } from '@/components/ui/button';

function formatTimestamp(iso: string): string {
	try {
		return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	} catch {
		return '';
	}
}

// Minimal markdown: bold **text**, italic *text*, inline code `code`
function renderInline(text: string): React.ReactNode[] {
	const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
	return parts.map((part, i) => {
		if (part.startsWith('**') && part.endsWith('**')) {
			return <strong key={i}>{part.slice(2, -2)}</strong>;
		}
		if (part.startsWith('*') && part.endsWith('*')) {
			return <em key={i}>{part.slice(1, -1)}</em>;
		}
		if (part.startsWith('`') && part.endsWith('`')) {
			return (
				<code
					key={i}
					className="font-mono text-[11px] bg-muted/60 px-1 rounded">
					{part.slice(1, -1)}
				</code>
			);
		}
		return part;
	});
}

// Strip fenced code blocks from assistant messages (we render them as EntityPreviewCard)
function stripJsonBlock(text: string): string {
	// Also strip unterminated fences so partial JSON doesn't leak into the chat bubble.
	return text.replace(/```(?:json)?\s*[\s\S]*?(?:```|$)/gi, '').trim();
}

function getAssistantDisplayText(message: ChatMessage): string {
	const stripped = stripJsonBlock(message.content);
	if (stripped) return stripped;
	if (message.preview?.summary) return message.preview.summary;
	return message.content.trim();
}

interface ChatMessageBubbleProps {
	message: ChatMessage;
	isStreaming?: boolean;
	onQuickChoice?: (message: ChatMessage, choice: 'enter-now' | 'do-later') => void;
	onRetry?: (message: ChatMessage) => void;
	retryDisabled?: boolean;
	showRetry?: boolean;
}

export function ChatMessageBubble({
	message,
	isStreaming,
	onQuickChoice,
	onRetry,
	retryDisabled,
	showRetry,
}: ChatMessageBubbleProps) {
	const isUser = message.role === 'user';
	const displayText = isUser ? message.content : getAssistantDisplayText(message);
	const showMissingDataChoices = !isUser && Boolean(message.preview?.missingDataRequest);
	const shouldShowRetry =
		Boolean(showRetry) || (!isUser && Boolean(message.error?.canRetry) && Boolean(onRetry));

	return (
		<div className={cn('flex gap-2 items-end', isUser ? 'flex-row-reverse' : 'flex-row')}>
			{/* Avatar dot */}
			{!isUser && (
				<div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mb-0.5">
					<span className="text-[10px]">🤖</span>
				</div>
			)}

			<div
				className={cn(
					'rounded-2xl px-3.5 py-2.5 max-w-[85%] text-sm',
					isUser
						? 'bg-primary text-primary-foreground rounded-tr-sm'
						: 'bg-muted text-foreground rounded-tl-sm'
				)}>
				{/* Multi-line content with inline markdown */}
				<div className="whitespace-pre-wrap break-words">
					{displayText.split('\n').map((line, i) => (
						<p
							key={i}
							className={i > 0 ? 'mt-1' : ''}>
							{renderInline(line)}
						</p>
					))}
				</div>

				{/* Streaming cursor */}
				{isStreaming && (
					<span className="inline-block h-3.5 w-0.5 bg-current ml-0.5 animate-pulse rounded-full" />
				)}

				{showMissingDataChoices && onQuickChoice && (
					<div className="mt-2 flex flex-wrap gap-1.5">
						<Button
							size="sm"
							variant="secondary"
							className="h-6 rounded-full px-2.5 text-[11px] font-medium border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
							onClick={() => onQuickChoice(message, 'enter-now')}>
							Enter now
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-6 rounded-full px-2.5 text-[11px] font-medium border border-border/70 bg-background/20 hover:bg-background/35"
							onClick={() => onQuickChoice(message, 'do-later')}>
							Do it later
						</Button>
					</div>
				)}

				{shouldShowRetry && (
					<div className="mt-2 flex flex-wrap gap-1.5">
						<Button
							size="sm"
							variant="secondary"
							className="h-6 rounded-full px-2.5 text-[11px] font-medium"
							onClick={() => onRetry?.(message)}
							disabled={retryDisabled}>
							<RefreshCw className="mr-1 h-3 w-3" />
							Resend message
						</Button>
					</div>
				)}

				<p
					className={cn(
						'text-[10px] mt-1.5',
						isUser
							? 'text-primary-foreground/50 text-right'
							: 'text-muted-foreground/70'
					)}>
					{formatTimestamp(message.timestamp)}
				</p>
			</div>
		</div>
	);
}

/** Skeleton bubble shown during streaming */
export function StreamingBubble({ content }: { content: string }) {
	const display = stripJsonBlock(content);
	return (
		<div className="flex gap-2 items-end">
			<div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mb-0.5">
				<span className="text-[10px]">🤖</span>
			</div>
			<div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%] bg-muted text-foreground text-sm">
				<div className="whitespace-pre-wrap break-words">
					{display || <span className="opacity-50">Thinking…</span>}
					<span className="inline-block h-3.5 w-0.5 bg-current ml-0.5 animate-pulse rounded-full" />
				</div>
			</div>
		</div>
	);
}
