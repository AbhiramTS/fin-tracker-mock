import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SubpageLayout({
	title,
	subtitle,
	onBack,
	children,
}: {
	title: string;
	subtitle?: string;
	onBack: () => void;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-3">
				<Button
					variant="ghost"
					size="sm"
					onClick={onBack}
					className="w-fit px-0 text-muted-foreground hover:text-foreground">
					<ArrowLeft className="h-4 w-4" /> Back
				</Button>
				<div>
					<h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
					{subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
				</div>
			</div>

			<div className="rounded-2xl border border-border bg-card p-4 sm:p-5">{children}</div>
		</div>
	);
}
