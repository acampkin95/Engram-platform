'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal = memo(function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: Readonly<ModalProps>) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <DialogPrimitive.Content
            className={cn(
              'relative w-full bg-[#0d0d1a] border border-[#1e1e3a] rounded-xl shadow-2xl',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-bottom-[4%]',
              sizes[size],
            )}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e3a] bg-black/10">
                <DialogPrimitive.Title className="text-sm font-semibold text-[#f0eef8] font-display">
                  {title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close className="p-1 rounded hover:bg-[#1e1e3a]/50 text-[#8580a0] hover:text-[#f0eef8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#F2A93B]/50">
                  <X className="w-4 h-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>
            )}
            <div className="p-5">{children}</div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
});

// Export primitives if more complex dialogs are needed
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogContent = DialogPrimitive.Content;
export const DialogHeader = DialogPrimitive.Title;
export const DialogClose = DialogPrimitive.Close;
