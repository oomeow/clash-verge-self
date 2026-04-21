import { useEffect } from "react";

import { BaseDialog } from "../base";

interface Props {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmViewer = (props: Props) => {
  const { open, title, message, onClose, onConfirm } = props;

  useEffect(() => {
    if (!open) return;
  }, [open]);

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      onOk={onConfirm}
      onCancel={onClose}
      title={title}>
      {message}
    </BaseDialog>
  );
};
