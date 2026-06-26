import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-[#EFD39B] bg-[#FFFAF0] text-[#9A6700]',
        danger: 'border-[#F3B8B0] bg-[#FFF7F5] text-[#B42318]',
        info: 'border-[#B7C3D0] bg-[#F2F5F9] text-[#344054]',
        neutral: 'border-[#D9E1EA] bg-[#F8FAFC] text-[#667085]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
