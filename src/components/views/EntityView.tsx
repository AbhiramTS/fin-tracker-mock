import { useState, type ComponentType, type ReactNode } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import type { EntityName, BaseRecord } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormComp = ComponentType<any>;

interface EntityViewProps<T extends BaseRecord> {
	title: string;
	subtitle?: string;
	entity: EntityName;
	FormComp: AnyFormComp;
	formProps?: Record<string, unknown>;
	formTitle?: string;
	children: ReactNode;
	headerRight?: ReactNode;
	onAfterSave?: (saved: BaseRecord) => void;
}

export function EntityView<T extends BaseRecord>({
	title,
	subtitle,
	entity,
	FormComp,
	formProps = {},
	formTitle,
	children,
	headerRight,
	onAfterSave,
}: EntityViewProps<T>) {
	const { save } = useApp();
	const [addOpen, setAddOpen] = useState(false);
	const [editRecord, setEditRecord] = useState<T | null>(null);

	const handleSave = async (data: Partial<T>) => {
		const saved = await save(entity, data as Record<string, unknown>);
		onAfterSave?.(saved);
		setAddOpen(false);
		setEditRecord(null);
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-start justify-between">
				<div>
					<h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
					{subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
				</div>
				<div className="flex items-center gap-2">
					{headerRight}
					<Button
						size="sm"
						onClick={() => setAddOpen(true)}>
						<Plus className="h-4 w-4" /> Add
					</Button>
				</div>
			</div>

			{children}

			{/* Add dialog */}
			<Dialog
				open={addOpen}
				onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{formTitle ?? `Add ${title}`}</DialogTitle>
					</DialogHeader>
					<FormComp
						{...formProps}
						onSave={handleSave}
						onCancel={() => setAddOpen(false)}
					/>
				</DialogContent>
			</Dialog>

			{/* Edit dialog */}
			<Dialog
				open={!!editRecord}
				onOpenChange={(o) => !o && setEditRecord(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit {formTitle ?? title}</DialogTitle>
					</DialogHeader>
					{editRecord && (
						<FormComp
							{...formProps}
							initialData={editRecord}
							onSave={handleSave}
							onCancel={() => setEditRecord(null)}
						/>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ── useEditDelete ─────────────────────────────────────────────────────────────
// Hook for views that need inline Edit + Delete buttons on each row.
// Returns handlers and the edit dialog state — the actual dialog is
// rendered by EntityView above, but views that live outside EntityView
// (like IncomeView with Tabs) use this to get a self-contained edit dialog.

interface UseEditDeleteOptions<T extends BaseRecord> {
	entity: EntityName;
	FormComp: AnyFormComp;
	formProps?: Record<string, unknown>;
	formTitle?: string;
}

export function useEditDelete<T extends BaseRecord>({
	entity,
	FormComp,
	formProps = {},
	formTitle,
}: UseEditDeleteOptions<T>) {
	const { save, remove } = useApp();
	const [editRecord, setEditRecord] = useState<T | null>(null);

	const handleSave = async (data: Partial<T>) => {
		await save(entity, data as Record<string, unknown>);
		setEditRecord(null);
	};

	const EditDialog = editRecord ? (
		<Dialog
			open={!!editRecord}
			onOpenChange={(o) => !o && setEditRecord(null)}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit {formTitle ?? entity}</DialogTitle>
				</DialogHeader>
				<FormComp
					{...formProps}
					initialData={editRecord}
					onSave={handleSave}
					onCancel={() => setEditRecord(null)}
				/>
			</DialogContent>
		</Dialog>
	) : null;

	return {
		startEdit: (record: T) => setEditRecord(record),
		doRemove: (id: string) => remove(entity, id),
		EditDialog,
	};
}

// ── RowActions ────────────────────────────────────────────────────────────────
// Standardised Edit + Delete buttons for a list row.

interface RowActionsProps {
	onEdit: () => void;
	onDelete: () => void;
}

export function RowActions({ onEdit, onDelete }: RowActionsProps) {
	return (
		<div className="flex items-center gap-1 shrink-0">
			<Button
				size="icon-sm"
				variant="ghost"
				onClick={(e) => {
					e.stopPropagation();
					onEdit();
				}}
				title="Edit">
				<Pencil className="h-3.5 w-3.5" />
			</Button>
			<Button
				size="icon-sm"
				variant="destructive"
				onClick={(e) => {
					e.stopPropagation();
					onDelete();
				}}
				title="Delete">
				<Trash2 className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}
