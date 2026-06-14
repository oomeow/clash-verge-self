import { ILogItem } from "@/hooks/use-log-data";

interface Props {
  value: ILogItem;
}

const LogItem = (props: Props) => {
  const { value } = props;
  let msg = value.payload;

  msg = msg.replaceAll("-->", " ⇢ ");
  msg = msg.replaceAll("->", " ⇢ ");
  if (value.type.toLowerCase() === "info") {
    msg = msg.replaceAll(" using ", " ⇢ using ");
    msg = msg.replaceAll(" match ", " ⇢ match ");
  }
  msg = msg.replaceAll(" error: ", " ⇢ error ");

  return (
    <div className="hover:bg-primary/8 dark:hover:bg-primary/14 rounded-lg px-3 py-2 select-text">
      <div className="flex items-center gap-2">
        <span
          className="data-[type=error]:bg-error/12 data-[type=error]:text-error data-[type=err]:bg-error/12 data-[type=err]:text-error data-[type=warning]:bg-warning/12 data-[type=warning]:text-warning data-[type=warn]:bg-warning/12 data-[type=warn]:text-warning data-[type=info]:bg-info/12 data-[type=info]:text-info data-[type=inf]:bg-info/12 data-[type=inf]:text-info data-[type=debug]:bg-text-secondary/10 data-[type=debug]:text-text-secondary inline-block rounded-full px-1.5 py-0.5 text-center text-[10px] leading-normal font-semibold uppercase"
          data-type={value.type.toLowerCase()}>
          {value.type}
        </span>
        <span className="text-text-secondary text-xs">{value.time}</span>
      </div>
      <div className="mt-1">
        <span className="text-text-primary break-anywhere text-sm leading-snug">
          {msg}
        </span>
      </div>
    </div>
  );
};

export default LogItem;
