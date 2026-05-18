import InboxRounded from "@mui/icons-material/InboxRounded";
import { Stack, Typography } from "@mui/material";

interface Props {
  text?: React.ReactNode;
  extra?: React.ReactNode;
}

export const BaseEmpty = (props: Props) => {
  const { text = "Empty", extra } = props;

  return (
    <Stack
      className="text-text-secondary/75 h-full w-full items-center justify-center"
      spacing={1}>
      <InboxRounded className="text-[4em]" />
      <Typography className="text-[1.25em]">{text}</Typography>
      {extra}
    </Stack>
  );
};
