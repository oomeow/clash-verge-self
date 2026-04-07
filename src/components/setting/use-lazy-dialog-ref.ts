import { useCallback, useEffect, useRef, useState } from "react";

export function useLazyDialogRef<T extends object>() {
  const dialogRef = useRef<T>(null);
  const [mounted, setMounted] = useState(false);
  const pendingActionsRef = useRef<Array<(ref: T) => void>>([]);

  useEffect(() => {
    const ref = dialogRef.current;
    if (!mounted || !ref || pendingActionsRef.current.length === 0) return;

    const pendingActions = pendingActionsRef.current.splice(0);
    pendingActions.forEach((action) => action(ref));
  }, [mounted]);

  const ensureMounted = useCallback(() => {
    setMounted(true);
  }, []);

  const withDialog = useCallback((action: (ref: T) => void) => {
    if (dialogRef.current) {
      action(dialogRef.current);
      return;
    }

    pendingActionsRef.current.push(action);
    setMounted(true);
  }, []);

  const open = useCallback(() => {
    withDialog((ref) => {
      (ref as { open?: () => void }).open?.();
    });
  }, [withDialog]);

  return {
    dialogRef,
    mounted,
    ensureMounted,
    withDialog,
    open,
  };
}
