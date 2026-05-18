import { styled, TextField, type TextFieldProps } from "@mui/material";
import { useTranslation } from "react-i18next";

export const BaseStyledTextField = styled((props: TextFieldProps) => {
  const { t } = useTranslation();

  return (
    <TextField
      hiddenLabel
      fullWidth
      size="small"
      autoComplete="off"
      variant="outlined"
      spellCheck="false"
      placeholder={t("common.search.filterConditions")}
      sx={{ input: { py: 0.65, px: 1.25 } }}
      {...props}
    />
  );
})(() => ({}));
