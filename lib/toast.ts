import { Toast } from "@base-ui/react/toast";

// One toast manager for the whole app, so toasts can be shown from any client
// code (event handlers, after a server action returns), not just components.
export const toastManager = Toast.createToastManager();

type ToastOptions = {
  title: string;
  description?: string;
  /** e.g. { label: "Undo", onClick: restore } */
  action?: { label: string; onClick: () => void };
  /** Milliseconds before it closes; 0 keeps it open. Default 5000. */
  timeout?: number;
};

/** Shows a toast. Returns its id (for toastManager.close). */
export function toast({ title, description, action, timeout }: ToastOptions) {
  return toastManager.add({
    title,
    description,
    timeout,
    actionProps: action
      ? { children: action.label, onClick: action.onClick }
      : undefined,
  });
}
