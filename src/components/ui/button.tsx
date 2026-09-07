import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-semibold ring-offset-[#EEF2F6] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2937]/30 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
  {
    variants: {
      variant: {
        default: 'bg-[#1F2937] text-white border border-[#1F2937] hover:bg-[#111827]',
        destructive: 'bg-[#B42318]/10 text-[#B42318] border border-[#F3B8B0] hover:bg-[#B42318]/15',
        ghost: 'text-[#667085] hover:bg-[#EEF2F6] hover:text-[#182230]',
        outline: 'border border-[#D9E1EA] bg-white text-[#344054] hover:bg-[#F8FAFC] hover:border-[#B7C3D0]',
        secondary: 'bg-[#E7F7EF] text-[#087443] border border-[#B7E4CB] hover:bg-[#DDF3E8]',
      },
      size: {
        default: 'h-8 px-3 py-1',
        sm: 'h-7 px-2 text-[11px]',
        lg: 'h-10 px-5 text-sm',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = 'Button';

export { Button };
