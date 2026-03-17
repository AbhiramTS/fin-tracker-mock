import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

interface StatCardProps {
	icon?: ReactNode;
	label: string;
	value: string;
	sub?: string;
	variant?: 'default' | 'profit' | 'loss' | 'warning' | 'cyan';
	className?: string;
}

const variantClass: Record<string, string> = {
	default: 'text-foreground',
	profit: 'text-profit',
	loss: 'text-loss',
	warning: 'text-warning',
	cyan: 'text-cyan',
};

export function StatCard({
	icon,
	label,
	value,
	sub,
	variant = 'default',
	className,
}: StatCardProps) {
	return (
		<Card className={cn('overflow-hidden', className)}>
			<CardContent className="p-4">
				{icon && <div className="mb-2 text-xl">{icon}</div>}
				<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
					{label}
				</p>
				<p
					className={cn(
						'mt-1 font-mono text-xl font-bold leading-none tracking-tight',
						variantClass[variant]
					)}>
					{value}
				</p>
				{sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
			</CardContent>
		</Card>
	);
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn('grid grid-cols-2 gap-3', className)}>{children}</div>;
}
