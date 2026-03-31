import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ─────────────────────────────────────────────────────────────────────────────
// Imperative confirm dialog.
//
// Usage:
//   const confirm = useConfirm();
//   const ok = await confirm({ title: 'Delete X?', description: '...' });
//   if (ok) { ... }
//
// When `blockedBy` is non-empty the dialog shows a blocking error (no confirm
// button) — used to prevent deleting entities that have associated records.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfirmOptions {
	title: string;
	description?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	/** When set, renders a blocking "cannot delete" dialog instead of a confirm. */
	blockedBy?: string[];
}

type Resolver = (value: boolean) => void;

interface ConfirmContextValue {
	confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmCtx = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [opts, setOpts] = useState<ConfirmOptions>({ title: '' });
	const resolverRef = useRef<Resolver | null>(null);

	const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
		return new Promise((resolve) => {
			resolverRef.current = resolve;
			setOpts(options);
			setOpen(true);
		});
	}, []);

	const settle = (value: boolean) => {
		setOpen(false);
		resolverRef.current?.(value);
		resolverRef.current = null;
	};

	const isBlocked = Boolean(opts.blockedBy?.length);

	return (
		<ConfirmCtx.Provider value={{ confirm }}>
			{children}
			<Dialog
				open={open}
				onOpenChange={(v) => {
					if (!v) settle(false);
				}}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							{isBlocked ? (
								<>
									<AlertTriangle className="h-4 w-4 text-warning shrink-0" />
									Cannot delete
								</>
							) : (
								<>
									<Trash2 className="h-4 w-4 text-destructive shrink-0" />
									{opts.title}
								</>
							)}
						</DialogTitle>
						<DialogDescription asChild>
							<div>
								{isBlocked ? (
									<>
										<p>
											<strong>{opts.title}</strong> cannot be deleted because
											it has associated data:
										</p>
										<ul className="mt-2 list-disc list-inside space-y-0.5 text-sm">
											{opts.blockedBy?.map((dep) => (
												<li key={dep}>{dep}</li>
											))}
										</ul>
										<p className="mt-2 text-xs">
											Remove the associated records first, then try again.
										</p>
									</>
								) : (
									<p>{opts.description ?? 'This action cannot be undone.'}</p>
								)}
							</div>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						{isBlocked ? (
							<Button
								variant="outline"
								onClick={() => settle(false)}>
								{opts.cancelLabel ?? 'Close'}
							</Button>
						) : (
							<>
								<Button
									variant="outline"
									onClick={() => settle(false)}>
									{opts.cancelLabel ?? 'Cancel'}
								</Button>
								<Button
									variant="destructive"
									onClick={() => settle(true)}>
									{opts.confirmLabel ?? 'Delete'}
								</Button>
							</>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</ConfirmCtx.Provider>
	);
}

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
	const ctx = useContext(ConfirmCtx);
	if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
	return ctx.confirm;
}
