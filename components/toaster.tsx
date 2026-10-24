"use client";

import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";
import { toastManager } from "@/lib/toast";

/** Renders toasts from lib/toast.ts. Mounted once, in the root layout. */
export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager} limit={3}>
      <Toast.Portal>
        <Toast.Viewport className="fixed inset-x-4 bottom-4 z-50 flex flex-col items-stretch gap-2 outline-none sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="flex items-center gap-2 rounded-xl border border-border bg-surface py-2 pr-2 pl-4 text-foreground shadow-lg transition-all duration-200 data-ending-style:translate-y-2 data-ending-style:opacity-0 data-limited:hidden data-starting-style:translate-y-2 data-starting-style:opacity-0"
    >
      <Toast.Content className="flex min-w-0 flex-1 flex-col py-1">
        <Toast.Title className="font-medium" />
        <Toast.Description className="text-sm text-muted-foreground" />
      </Toast.Content>
      {toast.actionProps && (
        <Toast.Action className="h-11 shrink-0 rounded-lg px-3 font-semibold text-accent-text outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50" />
      )}
      <Toast.Close
        aria-label="Dismiss"
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X className="size-4" aria-hidden />
      </Toast.Close>
    </Toast.Root>
  ));
}
