import { useState } from 'react';
import { Bot, Maximize2, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAgentChat } from '@/context/AgentContext';
import { useNavigation } from '@/context/NavigationContext';
import { ChatWindow } from './ChatWindow';

export function ChatDrawer() {
	const [open, setOpen] = useState(false);
	const { currentSession, startNewSession } = useAgentChat();
	const { setTab } = useNavigation();

	const handleOpen = () => {
		if (!currentSession) startNewSession();
		setOpen(true);
	};

	const handleExpand = () => {
		setTab('agent');
		setOpen(false);
	};

	const handleNewChat = () => {
		startNewSession();
	};

	return (
		<>
			{/* Floating Action Button */}
			<button
				onClick={handleOpen}
				aria-label="Open AI Assistant"
				className={cn(
					// Above mobile bottom nav (z-30), below mobile drawer (z-40)
					'fixed z-[38] bottom-[4.5rem] right-4 md:bottom-6 md:right-6',
					'h-12 w-12 rounded-full bg-primary text-primary-foreground',
					'shadow-lg shadow-primary/30 flex items-center justify-center',
					'hover:scale-105 active:scale-95 transition-transform',
					open && 'opacity-0 pointer-events-none'
				)}>
				<Bot className="h-5 w-5" />
			</button>

			{/* Backdrop (mobile only) */}
			{open && (
				<div
					className="fixed inset-0 z-[48] bg-black/40 backdrop-blur-sm md:hidden"
					onClick={() => setOpen(false)}
				/>
			)}

			{/* Drawer panel */}
			{open && (
				<div
					className={cn(
						'fixed z-[49] bg-card border border-border shadow-2xl flex flex-col',
						'animate-slide-up',
						// Mobile: full-width sheet from bottom
						'bottom-0 left-0 right-0 rounded-t-2xl h-[72vh]',
						// Desktop: floating panel bottom-right
						'md:bottom-4 md:left-auto md:right-4 md:rounded-2xl md:w-[400px] md:h-[70vh]'
					)}>
					{/* Header */}
					<div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
						<div className="flex items-center gap-2">
							<Bot className="h-4 w-4 text-primary" />
							<span className="font-display font-semibold text-sm">
								AI Assistant
							</span>
							{currentSession?.title && (
								<span className="text-xs text-muted-foreground truncate max-w-[140px]">
									· {currentSession.title}
								</span>
							)}
						</div>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={handleNewChat}
								title="New chat">
								<Plus className="h-3.5 w-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={handleExpand}
								title="Open full view">
								<Maximize2 className="h-3.5 w-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => setOpen(false)}
								title="Close">
								<X className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{/* Chat content */}
					<ChatWindow className="flex-1 min-h-0" />
				</div>
			)}
		</>
	);
}
