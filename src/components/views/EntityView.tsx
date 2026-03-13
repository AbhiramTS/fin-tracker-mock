import { useState, type ComponentType, type ReactNode } from 'react';
import { Btn } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { T } from '@/components/ui/tokens';
import { useApp } from '@/context/AppContext';
import type { EntityName, BaseRecord } from '@/types';

type BaseFormProps<TRecord extends BaseRecord> = {
	initialData?: Partial<TRecord>;
	onSave: (data: Partial<TRecord>) => void;
	onCancel: () => void;
};

interface EntityViewProps<TRecord extends BaseRecord, TExtraFormProps extends object = {}> {
	title: string;
	sub?: string;
	entity: EntityName;
	FormComp: ComponentType<BaseFormProps<TRecord> & TExtraFormProps>;
	formProps?: TExtraFormProps;
	children: ReactNode;
}

export function EntityView<TRecord extends BaseRecord, TExtraFormProps extends object = {}>({
	title,
	sub,
	entity,
	FormComp,
	formProps = {} as TExtraFormProps,
	children,
}: EntityViewProps<TRecord, TExtraFormProps>) {
	const { save } = useApp();
	const [open, setOpen] = useState(false);

	const handleSave = async (data: Partial<TRecord>) => {
		await save(entity, data as Partial<BaseRecord>);
		setOpen(false);
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
				}}>
				<div>
					<h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.text }}>
						{title}
					</h2>
					{sub && (
						<div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{sub}</div>
					)}
				</div>
				<Btn onClick={() => setOpen(true)}>+ Add</Btn>
			</div>

			{children}

			{open && (
				<Modal
					title={`Add ${title}`}
					onClose={() => setOpen(false)}>
					<FormComp
						{...(formProps as TExtraFormProps)}
						onSave={handleSave}
						onCancel={() => setOpen(false)}
					/>
				</Modal>
			)}
		</div>
	);
}
