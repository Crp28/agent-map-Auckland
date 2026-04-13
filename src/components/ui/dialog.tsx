"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type AppDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

export function AppDialog({ open, onOpenChange, title, description, children }: AppDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[88dvh] w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-md border border-[#cbd5e1] bg-white p-5 shadow-xl focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-xl font-semibold text-[#111827]">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm leading-6 text-[#475569]">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close className="grid min-h-11 min-w-11 place-items-center rounded-md border border-[#cbd5e1] text-[#334155] hover:bg-[#eef3f8] focus:outline-none focus:ring-2 focus:ring-[#0056a7]">
              <X aria-hidden="true" size={18} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div className="mt-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
