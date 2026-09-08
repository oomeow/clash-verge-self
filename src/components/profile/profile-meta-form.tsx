import { InputAdornment, InputLabel, TextField } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { SwitchLovely } from "@/components/base";

const text = {
  fullWidth: true,
  size: "small",
  margin: "dense",
  variant: "outlined",
  autoComplete: "off",
  autoCorrect: "off",
} as const;

interface Props {
  isRemote: boolean;
}

export const ProfileMetaForm = (props: Props) => {
  const { isRemote } = props;
  const { t } = useTranslation();
  const { control } = useFormContext<IProfileItem>();

  return (
    <form>
      <Controller
        name="name"
        control={control}
        render={({ field }) => (
          <TextField
            {...text}
            {...field}
            required
            label={t("common.fields.name")}
          />
        )}
      />
      <Controller
        name="desc"
        control={control}
        render={({ field }) => (
          <TextField
            {...text}
            {...field}
            label={t("common.fields.description")}
          />
        )}
      />
      {isRemote && (
        <>
          <Controller
            name="url"
            control={control}
            render={({ field }) => (
              <TextField
                {...text}
                {...field}
                multiline
                label={t("pages.profiles.fields.subscriptionUrl")}
              />
            )}
          />
          <Controller
            name="option.user_agent"
            control={control}
            render={({ field }) => (
              <TextField {...text} {...field} label="User Agent" />
            )}
          />
          <Controller
            name="option.update_interval"
            control={control}
            render={({ field }) => (
              <TextField
                {...text}
                {...field}
                onChange={(e) => {
                  e.target.value = e.target.value
                    ?.replace(/\D/, "")
                    .slice(0, 10);
                  field.onChange(e);
                }}
                label={t("pages.profiles.fields.updateInterval")}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">mins</InputAdornment>
                    ),
                  },
                }}
              />
            )}
          />
          <Controller
            name="option.with_proxy"
            control={control}
            render={({ field }) => (
              <div className="my-2 ml-2 flex items-center justify-between">
                <InputLabel>
                  {t("pages.profiles.fields.useSystemProxy")}
                </InputLabel>
                <SwitchLovely
                  checked={field.value}
                  {...field}
                  color="primary"
                />
              </div>
            )}
          />
          <Controller
            name="option.self_proxy"
            control={control}
            render={({ field }) => (
              <div className="my-2 ml-2 flex items-center justify-between">
                <InputLabel>
                  {t("pages.profiles.fields.useClashProxy")}
                </InputLabel>
                <SwitchLovely
                  checked={field.value}
                  {...field}
                  color="primary"
                />
              </div>
            )}
          />
          <Controller
            name="option.danger_accept_invalid_certs"
            control={control}
            render={({ field }) => (
              <div className="my-2 ml-2 flex items-center justify-between">
                <InputLabel>
                  {t("pages.profiles.fields.acceptInvalidCertsDanger")}
                </InputLabel>
                <SwitchLovely
                  checked={field.value}
                  {...field}
                  color="primary"
                />
              </div>
            )}
          />
        </>
      )}
    </form>
  );
};
