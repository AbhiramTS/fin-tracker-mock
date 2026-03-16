import { useState, type ComponentType, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import type { EntityName, BaseRecord } from '@/types';

// FormComp is typed loosely so forms that require extra props (e.g. `accounts`)
// can be passed via formProps without triggering index-signature conflicts.
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
	/** Called after save completes, in addition to the default dispatch */
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
	const [open, setOpen] = useState(false);

	const handleSave = async (data: Partial<T>) => {
		const saved = await save(entity, data as Record<string, unknown>);
		onAfterSave?.(saved);
		setOpen(false);
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
						onClick={() => setOpen(true)}>
						<Plus className="h-4 w-4" />
						Add
					</Button>
				</div>
			</div>

			{children}

			<Dialog
				open={open}
				onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{formTitle ?? `Add ${title}`}</DialogTitle>
					</DialogHeader>
					<FormComp
						{...formProps}
						onSave={handleSave}
						onCancel={() => setOpen(false)}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
