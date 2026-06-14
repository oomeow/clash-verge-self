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

  const type = value.type.toLowerCase();

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2">
        <span
          className="data-[type=debug]:bg-text-secondary/10 data-[type=debug]:text-text-secondary data-[type=error]:bg-error/12 data-[type=error]:text-error data-[type=err]:bg-error/12 data-[type=err]:text-error data-[type=info]:bg-info/12 data-[type=info]:text-info data-[type=inf]:bg-info/12 data-[type=inf]:text-info data-[type=warn]:bg-warning/12 data-[type=warn]:text-warning data-[type=warning]:bg-warning/12 data-[type=warning]:text-warning inline-flex h-5 min-w-11 items-center justify-center rounded-sm px-1.5 text-[11px] leading-none font-bold uppercase"
          data-type={type}>
          {value.type}
        </span>
        <span className="text-text-secondary/60 text-[11px]">{value.time}</span>
      </div>
      <p className="text-text-primary break-anywhere mt-1 text-sm leading-normal select-text">
        {msg}
      </p>
    </div>
  );
};

export default LogItem;
