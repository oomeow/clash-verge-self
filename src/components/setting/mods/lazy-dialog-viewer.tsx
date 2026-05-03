import {
  forwardRef,
  type ForwardRefExoticComponent,
  lazy,
  type PropsWithoutRef,
  type RefAttributes,
  useEffect,
} from "react";

import type { DialogRef } from "@/components/base";

type ReadyProps = {
  onReady?: () => void;
};

type DialogViewerModule<P extends object> = {
  default: ForwardRefExoticComponent<
    PropsWithoutRef<P> & RefAttributes<DialogRef>
  >;
};

export const lazyDialogViewer = <P extends object>(
  load: () => Promise<DialogViewerModule<P>>,
) =>
  lazy(async () => {
    const mod = await load();

    const LazyDialogViewer = forwardRef<DialogRef, P & ReadyProps>(
      ({ onReady, ...props }, ref) => {
        useEffect(() => {
          onReady?.();
        }, [onReady]);

        const Viewer = mod.default as any;
        return <Viewer {...props} ref={ref} />;
      },
    );

    LazyDialogViewer.displayName = "LazyDialogViewer";

    return { default: LazyDialogViewer };
  });
