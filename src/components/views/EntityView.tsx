import { type ComponentType, type ReactNode } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubpageLayout } from '@/components/ui/subpage-layout';
import { useApp } from '@/context/AppContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useNavigation, type TabId } from '@/context/NavigationContext';
import type { AppState, EntityName, BaseRecord } from '@/types';

// ── Dependency checking ───────────────────────────────────────────────────────
// Returns a human-readable list of associated records that block deletion.
function getDeleteDependencies(entity: EntityName, id: string, state: AppState): string[] {
	const deps: string[] = [];
	switch (entity) {
		case 'accounts': {
			const jeCnt = state.journalEntries.filter(
				(e) => e.debitAccountHeadId === id || e.creditAccountHeadId === id
			).length;
			if (jeCnt) deps.push(`${jeCnt} journal ${jeCnt === 1 ? 'entry' : 'entries'}`);
			const rpCnt = state.recurringPayments.filter((r) => r.accountId === id).length;
			if (rpCnt) deps.push(`${rpCnt} recurring payment${rpCnt !== 1 ? 's' : ''}`);
			const riCnt = state.recurringIncomes.filter((r) => r.accountId === id).length;
			if (riCnt) deps.push(`${riCnt} recurring income${riCnt !== 1 ? 's' : ''}`);
			const lCnt = state.loans.filter((l) => l.accountId === id).length;
			if (lCnt) deps.push(`${lCnt} loan${lCnt !== 1 ? 's' : ''}`);
			const rvCnt = state.receivables.filter((r) => r.accountId === id).length;
			if (rvCnt) deps.push(`${rvCnt} receivable${rvCnt !== 1 ? 's' : ''}`);
			break;
		}
		case 'loans': {
			const poCnt = state.paymentOccurrences.filter((p) => p.sourceId === id).length;
			if (poCnt) deps.push(`${poCnt} payment schedule ${poCnt === 1 ? 'entry' : 'entries'}`);
			const jeCnt = state.journalEntries.filter(
				(e) => e.debitAccountHeadId === id || e.creditAccountHeadId === id
			).length;
			if (jeCnt) deps.push(`${jeCnt} journal ${jeCnt === 1 ? 'entry' : 'entries'}`);
			break;
		}
		case 'investments': {
			const jeCnt = state.journalEntries.filter(
				(e) => e.debitAccountHeadId === id || e.creditAccountHeadId === id
			).length;
			if (jeCnt) deps.push(`${jeCnt} journal ${jeCnt === 1 ? 'entry' : 'entries'}`);
			break;
		}
		case 'receivables': {
			const rrCnt = state.repaymentRecords.filter((r) => r.receivableId === id).length;
			if (rrCnt) deps.push(`${rrCnt} repayment record${rrCnt !== 1 ? 's' : ''}`);
			break;
		}
		case 'recurringPayments':
		case 'recurringIncomes': {
			const poCnt = state.paymentOccurrences.filter((p) => p.sourceId === id).length;
			if (poCnt) deps.push(`${poCnt} payment schedule ${poCnt === 1 ? 'entry' : 'entries'}`);
			break;
		}
		default:
			break;
	}
	return deps;
}

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
	onAfterSave?: (saved: BaseRecord) => void | Promise<void>;
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
	const { state, save, remove } = useApp();
	const confirm = useConfirm();
	const { route, openSubpage, goBack } = useNavigation();
	const isAddPage = route.tab === tab && route.subpage === addSubpage;
	const isEditPage = route.tab === tab && route.subpage === editSubpage;
	const editRecord = isEditPage
		? (records.find((record) => record.id === route.id) ?? null)
		: null;

	const handleSave = async (data: Partial<T>) => {
		const saved = await save(entity, data as Record<string, unknown>);
		await onAfterSave?.(saved);
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
		doRemove: async (id: string, label?: string) => {
			const record = records.find((r) => r.id === id);
			const displayName =
				label ??
				(record && 'name' in record && typeof record.name === 'string'
					? record.name
					: 'this record');
			const deps = getDeleteDependencies(entity, id, state);
			const confirmed = await confirm(
				deps.length > 0
					? { title: displayName, blockedBy: deps }
					: {
							title: `Delete "${displayName}"?`,
							description: 'This action cannot be undone.',
						}
			);
			if (!confirmed) return;
			await remove(entity, id);
		},
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
