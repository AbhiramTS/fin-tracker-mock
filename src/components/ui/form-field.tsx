import { type ReactNode } from 'react';
import { Label } from './label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
	label: string;
	children: ReactNode;
	className?: string;
	error?: string;
	hint?: string;
	span?: 1 | 2;
}

export function FormField({ label, children, className, error, hint, span }: FormFieldProps) {
	return (
		<div className={cn('flex flex-col gap-1.5', span === 2 && 'col-span-2', className)}>
			<Label>{label}</Label>
			{children}
			{hint && <p className="text-xs text-muted-foreground">{hint}</p>}
			{error && <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}

export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn('grid grid-cols-2 gap-3', className)}>{children}</div>;
}

export function FormActions({
	onCancel,
	saveLabel = 'Save',
}: {
	onCancel: () => void;
	saveLabel?: string;
}) {
	return (
		<div className="flex justify-end gap-2 pt-2">
			<button
				type="button"
				onClick={onCancel}
				className="h-9 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors">
				Cancel
			</button>
			<button
				type="submit"
				className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors active:scale-95">
				{saveLabel}
			</button>
		</div>
	);
}
