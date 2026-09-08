import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Update from "@mui/icons-material/Update";
import {
  alpha,
  Box,
  Card,
  Collapse,
  IconButton,
  type IconButtonProps,
  ListItemButton,
  styled,
  Switch,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { Virtuoso } from "react-virtuoso";

import { type CustomRule, useRulesStateStore } from "@/stores/rulesStateStore";

interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
}));

const COLOR = [
  "primary",
  "secondary",
  "info.main",
  "warning.main",
  "success.main",
];

interface Props {
  index: number;
  value: CustomRule;
  matchPayloadItems?: string[];
}

const parseColor = (text: string) => {
  if (text === "REJECT" || text === "REJECT-DROP") return "error.main";
  if (text === "DIRECT") return "text.primary";

  let sum = 0;
  for (let i = 0; i < text.length; i++) {
    sum += text.charCodeAt(i);
  }
  return COLOR[sum % COLOR.length];
};

export const RuleItem = (props: Props) => {
  const { index, value, matchPayloadItems } = props;
  const currentValue = useRulesStateStore(
    (s) =>
      s.rules.find(
        (rule) => rule.index === value.index && rule.payload === value.payload,
      ) ?? value,
  );
  const isRuleSet = currentValue.type === "RuleSet";
  const expanded = isRuleSet && currentValue.expanded;
  const toggleRuleExpanded = useRulesStateStore((s) => s.toggleRuleExpanded);
  const disableRules = useRulesStateStore((s) => s.disableRules);

  const showHit = !!(
    currentValue.extra?.hitCount && currentValue.extra.hitCount > 0
  );
  const showMiss = !!(
    currentValue.extra?.missCount && currentValue.extra.missCount > 0
  );

  return (
    <Card
      elevation={0}
      className="shadow-sm"
      sx={{
        backgroundImage: "none",
        borderRadius: "12px",
      }}>
      <ListItemButton
        sx={(theme) => ({
          ...(expanded && {
            bgcolor: alpha(theme.palette.primary.main, 0.25),
            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.25) },
            ...theme.applyStyles("dark", {
              bgcolor: alpha(theme.palette.primary.main, 0.35),
              "&:hover": {
                bgcolor: alpha(theme.palette.primary.main, 0.35),
              },
            }),
            borderBottom: "1px solid var(--divider-color)",
          }),
          ...(currentValue.extra?.disabled && {
            bgcolor: theme.palette.action.disabledBackground,
            ":hover": {
              bgcolor: theme.palette.action.disabledBackground,
            },
          }),
        })}
        onClick={() => {
          if (currentValue.type === "RuleSet") {
            toggleRuleExpanded(currentValue.payload);
          }
        }}>
        <div className="w-full">
          <div className="flex w-full items-center justify-center">
            <Switch
              size="small"
              checked={!currentValue.extra?.disabled}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onChange={async () => {
                await disableRules({
                  [currentValue.index]: !currentValue.extra?.disabled,
                });
              }}
              sx={{ mr: 0.5 }}
            />

            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                lineHeight: 2,
                minWidth: 30,
                textAlign: "center",
              }}>
              {index}
            </Typography>

            <div className="w-full select-none">
              <div className="flex w-full items-center justify-between">
                <Typography
                  component="h6"
                  variant="subtitle1"
                  color={
                    currentValue.extra?.disabled
                      ? "text.disabled"
                      : "text.primary"
                  }
                  sx={
                    currentValue.extra?.disabled
                      ? { textDecoration: "line-through" }
                      : undefined
                  }>
                  {currentValue.payload || "-"}
                </Typography>
              </div>

              <div className="grid sm:grid-cols-1 md:grid-cols-2">
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    mr: 3,
                    minWidth: 120,
                    display: "inline-block",
                  }}>
                  {currentValue.type}
                  {isRuleSet && (
                    <span className="text-primary bg-primary/20 ml-2 inline-block rounded-full px-2 text-xs">
                      {currentValue.behavior}
                    </span>
                  )}
                </Typography>

                <Typography
                  component="span"
                  variant="body2"
                  color={parseColor(currentValue.proxy)}
                  sx={
                    currentValue.extra?.disabled
                      ? { textDecoration: "line-through" }
                      : undefined
                  }>
                  {currentValue.proxy}
                </Typography>
              </div>
            </div>

            <div className="h-full w-full items-center justify-end space-y-2">
              {isRuleSet && (
                <div className="flex items-center justify-end">
                  <div className="bg-primary/20 text-primary rounded-full px-2 text-sm">
                    {currentValue.ruleCount}
                  </div>
                  <div className="text-primary bg-primary/20 ml-2 flex items-center rounded-full px-2 py-0.5 text-xs">
                    <Update className="mr-1" fontSize="small" />
                    <span>{dayjs(currentValue.updatedAt).fromNow()}</span>
                  </div>
                </div>
              )}
              {(showHit || showMiss) && (
                <div className="text-text-disabled flex items-center justify-end text-xs">
                  {showHit && (
                    <div className="md:flex">
                      <div>
                        Hit:
                        <span className="text-primary inline-block h-fit w-fit px-1">
                          {currentValue.extra?.hitCount}
                        </span>
                      </div>
                      <div>
                        At:
                        <span className="text-primary inline-block h-fit w-fit px-1">
                          {dayjs(currentValue.extra?.hitAt).format(
                            "YYYY-MM-DD HH:mm:ss",
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/*{showMiss && (
                    <div>
                      Miss:
                      <span className="text-primary inline-block h-fit w-fit rounded-full px-1">
                        {value.extra?.missCount}
                      </span>
                      At:
                      <span className="text-primary inline-block h-fit w-fit rounded-full px-1">
                        {dayjs(value.extra?.missAt).format(
                          "YYYY-MM-DD HH:mm:ss",
                        )}
                      </span>
                    </div>
                  )}*/}
                </div>
              )}
            </div>

            <div className="flex w-20 items-center justify-center px-1">
              {isRuleSet && (
                <ExpandMore
                  color="primary"
                  expand={expanded}
                  aria-expanded={expanded}
                  aria-label="show more">
                  <ExpandMoreIcon />
                </ExpandMore>
              )}
            </div>
          </div>
        </div>
      </ListItemButton>
      {matchPayloadItems && (
        <Collapse
          in={expanded}
          timeout={0}
          unmountOnExit
          sx={[
            ({ palette: { primary, action } }) => ({
              bgcolor: alpha(primary.main, 0.15),
              ...(currentValue.extra?.disabled && {
                bgcolor: action.disabledBackground,
                opacity: action.disabledOpacity,
              }),
            }),
          ]}>
          <Box
            sx={{
              margin: "auto",
              padding: "0 6px 0 70px",
              height:
                matchPayloadItems.length > 10
                  ? "222px"
                  : `${matchPayloadItems.length * 22 + 2}px`,
            }}>
            <Virtuoso
              data={matchPayloadItems}
              increaseViewportBy={256}
              itemContent={(_index, item) => (
                <div className="leading-5 select-text">
                  <Typography
                    unselectable="on"
                    component="span"
                    variant="body2"
                    sx={{
                      color: "text.primary",
                    }}>
                    {item}
                  </Typography>
                </div>
              )}
            />
          </Box>
        </Collapse>
      )}
    </Card>
  );
};
