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
    <div className="hover:bg-action-hover [&_.time]:text-text-secondary [&_.type[data-type=error]]:text-error [&_.type[data-type=err]]:text-error [&_.type[data-type=warning]]:text-warning [&_.type[data-type=warn]]:text-warning [&_.type[data-type=info]]:text-info [&_.type[data-type=inf]]:text-info [&_.data]:text-text-primary [&_.data]:break-anywhere px-3 py-2 text-sm leading-tight transition-colors duration-150 select-text [&_.time]:ml-2 [&_.type]:inline-block [&_.type]:rounded-full [&_.type]:px-1.5 [&_.type]:text-center [&_.type]:text-xs [&_.type]:font-semibold [&_.type]:uppercase">
      <div>
        <span className="type" data-type={value.type.toLowerCase()}>
          {value.type}
        </span>
        <span className="time">{value.time}</span>
      </div>
      <div>
        <span className="data">{msg}</span>
      </div>
    </div>
  );
};

export default LogItem;
