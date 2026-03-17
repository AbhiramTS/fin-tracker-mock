import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
				destructive:
					'bg-destructive/15 text-destructive border border-destructive/25 hover:bg-destructive/25',
				outline:
					'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground',
				secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
				ghost: 'hover:bg-accent hover:text-accent-foreground',
				link: 'text-primary underline-offset-4 hover:underline',
				profit: 'bg-profit/15 text-profit border border-profit/25 hover:bg-profit/25',
				warning: 'bg-warning/15 text-warning border border-warning/25 hover:bg-warning/25',
				firebase:
					'bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold hover:opacity-90',
			},
			size: {
				default: 'h-9 px-4 py-2',
				sm: 'h-7 rounded-md px-3 text-xs',
				lg: 'h-11 rounded-lg px-6 text-base',
				icon: 'h-9 w-9',
				'icon-sm': 'h-7 w-7',
			},
		},
		defaultVariants: { variant: 'default', size: 'default' },
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button';
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	}
);
Button.displayName = 'Button';

export { Button, buttonVariants };
