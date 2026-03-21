import { type ComponentType, type ReactNode } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubpageLayout } from '@/components/ui/subpage-layout';
import { useApp } from '@/context/AppContext';
import { useNavigation, type TabId } from '@/context/NavigationContext';
import type { EntityName, BaseRecord } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormComp = ComponentType<any>;

interface EntityViewProps<T extends BaseRecord> {
	title: string;
	subtitle?: string;
	children: ReactNode;
	headerRight?: ReactNode;
	onAdd?: () => void;
	addLabel?: string;
}

export function EntityView<T extends BaseRecord>({
	title,
	subtitle,
	children,
	headerRight,
	onAdd,
	addLabel = 'Add',
}: EntityViewProps<T>) {
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
						onClick={onAdd}>
						<Plus className="h-4 w-4" /> {addLabel}
					</Button>
				</div>
			</div>

			{children}
		</div>
	);
}

interface UseEntityFormPageOptions<T extends BaseRecord> {
	tab: TabId;
	records: T[];
	entity: EntityName;
	FormComp: AnyFormComp;
	formProps?: Record<string, unknown>;
	pageTitle: string;
	formTitle?: string;
	onAfterSave?: (saved: BaseRecord) => void;
	addSubpage?: string;
	editSubpage?: string;
}

export function useEntityFormPage<T extends BaseRecord>({
	tab,
	records,
	entity,
	FormComp,
	formProps = {},
	pageTitle,
	formTitle,
	onAfterSave,
	addSubpage = 'new',
	editSubpage = 'edit',
}: UseEntityFormPageOptions<T>) {
	const { save, remove } = useApp();
	const { route, openSubpage, goBack } = useNavigation();
	const isAddPage = route.tab === tab && route.subpage === addSubpage;
	const isEditPage = route.tab === tab && route.subpage === editSubpage;
	const editRecord = isEditPage
		? (records.find((record) => record.id === route.id) ?? null)
		: null;

	const handleSave = async (data: Partial<T>) => {
		const saved = await save(entity, data as Record<string, unknown>);
		onAfterSave?.(saved);
		goBack();
	};

	const FormPage = isAddPage ? (
		<SubpageLayout
			title={`Add ${formTitle ?? pageTitle}`}
			onBack={goBack}>
			<FormComp
				{...formProps}
				onSave={handleSave}
				onCancel={goBack}
			/>
		</SubpageLayout>
	) : isEditPage ? (
		<SubpageLayout
			title={`Edit ${formTitle ?? pageTitle}`}
			subtitle={!editRecord ? 'This record is no longer available.' : undefined}
			onBack={goBack}>
			{editRecord ? (
				<FormComp
					{...formProps}
					initialData={editRecord}
					onSave={handleSave}
					onCancel={goBack}
				/>
			) : null}
		</SubpageLayout>
	) : null;

	return {
		openAdd: () => openSubpage(addSubpage, { tab }),
		startEdit: (record: T) => openSubpage(editSubpage, { tab, id: record.id }),
		doRemove: (id: string) => remove(entity, id),
		FormPage,
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
