import type { ComponentProps, ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { label } from '@/lib/domain';
import { cn } from '@/lib/utils';

export const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50';

export function NativeSelect({
  options,
  placeholder,
  className,
  ...props
}: ComponentProps<'select'> & { options: readonly string[]; placeholder?: string }) {
  return (
    <select className={cn(selectClass, className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

export function Field({
  label: text,
  htmlFor,
  errors,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  errors?: string[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{text}</Label>
      {children}
      {errors?.[0] && <p className="text-sm text-destructive">{errors[0]}</p>}
    </div>
  );
}
