import * as SliderPrimitive from '@radix-ui/react-slider';
import * as React from 'react';
import { cn } from '@/src/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[#1e1e3a]">
      <SliderPrimitive.Range className="absolute h-full bg-[#2EC4C4]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-[#2EC4C4] bg-[#0d0b1a] shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2EC4C4] disabled:pointer-events-none disabled:opacity-50" />
    {props.value && props.value.length > 1 && (
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-[#2EC4C4] bg-[#0d0b1a] shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2EC4C4] disabled:pointer-events-none disabled:opacity-50" />
    )}
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
