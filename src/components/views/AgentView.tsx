import { useState } from 'react';
import { Bot, Plus, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAgentChat } from '@/context/AgentContext';
import { ChatWindow } from '@/components/agent/ChatWindow';
import type { ChatSessionSummary } from '@/agent/types';

function formatSessionDate(iso: string): string {
	try {
		const d = new Date(iso);
		const now = new Date();
		const diffDays = Math.floor(
			(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
		);
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
	} catch {
		return '';
	}
}

function SessionCard({
	session,
	isActive,
	onSelect,
	onDelete,
}: {
	session: ChatSessionSummary;
	isActive: boolean;
	onSelect: () => void;
	onDelete: () => void;
}) {
	return (
		<div
			className={cn(
				'group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors',
				isActive
					? 'border-primary/30 bg-primary/8'
					: 'border-border hover:border-primary/20 hover:bg-accent'
			)}
			onClick={onSelect}>
			<MessageSquare
				className={cn('h-4 w-4 mt-0.5 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')}
			/>
			<div className="flex-1 min-w-0">
				<p
					className={cn(
						'text-sm font-medium truncate',
						isActive ? 'text-primary' : 'text-foreground'
					)}>
					{session.title || 'New Chat'}
				</p>
				<p className="text-xs text-muted-foreground mt-0.5">
					{session.messageCount} message{session.messageCount !== 1 ? 's' : ''} ·{' '}
					{formatSessionDate(session.updatedAt)}
				</p>
			</div>
			<button
				onClick={(e) => {
					e.stopPropagation();
					onDelete();
				}}
				className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-loss/10 hover:text-loss">
				<Trash2 className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}

export function AgentView() {
	const {
		sessions,
		currentSession,
		startNewSession,
		loadSession,
		deleteSession,
	} = useAgentChat();

	// Mobile: toggle between session list and chat panel
	const [mobileShowChat, setMobileShowChat] = useState(!!(currentSession));

	const handleNewChat = () => {
		startNewSession();
		setMobileShowChat(true);
	};

	const handleSelectSession = async (id: string) => {
		await loadSession(id);
		setMobileShowChat(true);
	};

	const handleDeleteSession = async (id: string) => {
		await deleteSession(id);
		if (currentSession?.id === id) setMobileShowChat(false);
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h2 className="font-display text-xl font-bold">AI Assistant</h2>
				{/* Mobile back button */}
				{mobileShowChat && (
					<Button
						variant="ghost"
						size="sm"
						className="md:hidden gap-1.5 text-xs"
						onClick={() => setMobileShowChat(false)}>
						← Chats
					</Button>
				)}
			</div>

			<div className="flex gap-3" style={{ height: 'calc(100vh - 11rem)' }}>
				{/* ── Session list ──────────────────────────────────────────── */}
				<div
					className={cn(
						'flex flex-col gap-2 shrink-0',
						'w-full md:w-56',
						mobileShowChat ? 'hidden md:flex' : 'flex'
					)}>
					<Button
						onClick={handleNewChat}
						size="sm"
						className="w-full gap-2 justify-start">
						<Plus className="h-4 w-4" />
						New Chat
					</Button>

					{sessions.length === 0 && (
						<div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
							<Bot className="h-8 w-8 opacity-20" />
							<p className="text-xs">No chats yet</p>
						</div>
					)}

					<div className="flex-1 overflow-y-auto space-y-1">
						{sessions.map((s) => (
							<SessionCard
								key={s.id}
								session={s}
								isActive={currentSession?.id === s.id}
								onSelect={() => void handleSelectSession(s.id)}
								onDelete={() => void handleDeleteSession(s.id)}
							/>
						))}
					</div>
				</div>

				{/* ── Chat panel ───────────────────────────────────────────── */}
				<div
					className={cn(
						'flex-1 rounded-xl border border-border overflow-hidden flex flex-col min-w-0',
						!mobileShowChat && 'hidden md:flex'
					)}>
					{currentSession ? (
						<>
							{/* Desktop session title bar */}
							<div className="hidden md:flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/20 shrink-0">
								<MessageSquare className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-medium text-muted-foreground truncate">
									{currentSession.title || 'New Chat'}
								</span>
							</div>
							<ChatWindow className="flex-1 min-h-0" />
						</>
					) : (
						<div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
							<Bot className="h-12 w-12 opacity-20" />
							<p className="text-sm">Select a chat or start a new one</p>
							<Button
								onClick={handleNewChat}
								variant="outline"
								size="sm"
								className="gap-2">
								<Plus className="h-4 w-4" />
								New Chat
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
