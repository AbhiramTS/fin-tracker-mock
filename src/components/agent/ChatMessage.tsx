import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/agent/types';

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
				<code key={i} className="font-mono text-[11px] bg-muted/60 px-1 rounded">
					{part.slice(1, -1)}
				</code>
			);
		}
		return part;
	});
}

// Strip fenced code blocks from assistant messages (we render them as EntityPreviewCard)
function stripJsonBlock(text: string): string {
	return text.replace(/```(?:json)?\s*[\s\S]*?```/g, '').trim();
}

interface ChatMessageBubbleProps {
	message: ChatMessage;
	isStreaming?: boolean;
}

export function ChatMessageBubble({ message, isStreaming }: ChatMessageBubbleProps) {
	const isUser = message.role === 'user';
	const displayText = isUser ? message.content : stripJsonBlock(message.content);

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
						<p key={i} className={i > 0 ? 'mt-1' : ''}>
							{renderInline(line)}
						</p>
					))}
				</div>

				{/* Streaming cursor */}
				{isStreaming && (
					<span className="inline-block h-3.5 w-0.5 bg-current ml-0.5 animate-pulse rounded-full" />
				)}

				<p
					className={cn(
						'text-[10px] mt-1.5',
						isUser ? 'text-primary-foreground/50 text-right' : 'text-muted-foreground/70'
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
