import React from 'react';
import { cn } from '@/lib/utils';
import {
	LucideIcon,
	PlusIcon,
} from 'lucide-react';

export type ContactInfoProps = React.ComponentProps<'div'> & {
	icon: LucideIcon;
	label: string;
	value: string;
};

export type ContactCardProps = React.ComponentProps<'div'> & {
	// Content props
	title?: string;
	description?: string;
	contactInfo?: ContactInfoProps[];
	formSectionClassName?: string;
};

export function ContactCard({
	title = 'Contact With Us',
	description = 'If you have any questions regarding our Services or need help, please fill out the form here. We do our best to respond within 1 business day.',
	contactInfo,
	className,
	formSectionClassName,
	children,
	...props
}: ContactCardProps) {
	return (
		<div
			className={cn(
				'bg-card border relative grid h-full w-full shadow md:grid-cols-2 lg:grid-cols-3 rounded-2xl',
				className,
			)}
			{...props}
		>
			<PlusIcon className="absolute -top-3 -left-3 h-6 w-6 text-muted-foreground/60 z-10" />
			<PlusIcon className="absolute -top-3 -right-3 h-6 w-6 text-muted-foreground/60 z-10" />
			<PlusIcon className="absolute -bottom-3 -left-3 h-6 w-6 text-muted-foreground/60 z-10" />
			<PlusIcon className="absolute -right-3 -bottom-3 h-6 w-6 text-muted-foreground/60 z-10" />
			<div className="flex flex-col justify-between lg:col-span-2">
				<div className="relative h-full space-y-4 px-6 py-8 md:p-10">
					<h2 className="text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl text-foreground">
						{title}
					</h2>
					<p className="text-muted-foreground max-w-xl text-sm md:text-base lg:text-lg leading-relaxed font-medium">
						{description}
					</p>
					<div className="grid gap-4 md:grid-cols-2 pt-4">
						{contactInfo?.map((info, index) => (
							<ContactInfo key={index} {...info} />
						))}
					</div>
				</div>
			</div>
			<div
				className={cn(
					'bg-muted/30 flex h-full w-full items-center border-t p-6 md:col-span-1 md:border-t-0 md:border-l rounded-b-2xl md:rounded-r-2xl md:rounded-bl-none',
					formSectionClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}

export function ContactInfo({
	icon: Icon,
	label,
	value,
	className,
	...props
}: ContactInfoProps) {
	return (
		<div className={cn('flex items-start gap-3.5 py-2', className)} {...props}>
			<div className="bg-yellow-400/10 text-yellow-600 border border-yellow-400/30 rounded-xl p-3 shrink-0">
				<Icon className="h-5 w-5" />
			</div>
			<div>
				<p className="font-semibold text-foreground text-sm">{label}</p>
				<p className="text-muted-foreground text-xs font-medium leading-relaxed mt-0.5 whitespace-pre-line">{value}</p>
			</div>
		</div>
	);
}
