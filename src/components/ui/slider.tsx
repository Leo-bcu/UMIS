import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[#2A2D3A]">
      <SliderPrimitive.Range className="absolute h-full bg-[#FFE600] shadow-[0_0_8px_rgba(255,230,0,0.4)]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-[#0A0A0F] bg-[#FFE600] shadow-[0_0_10px_rgba(255,230,0,0.6)] ring-offset-[#0A0A0F] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600]/50 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 transition-transform" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
