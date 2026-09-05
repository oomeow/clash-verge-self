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

  return (
    <BaseDialog
      title={title}
      open={open}
      contentStyle={{ width: 400 }}
      onClose={onClose}
      onOk={onConfirm}
      onCancel={onClose}>
      {message}
    </BaseDialog>
  );
};
