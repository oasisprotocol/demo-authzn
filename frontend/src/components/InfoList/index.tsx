import {JSX, VNode} from "preact";
import classes from "./index.module.css";

interface Props<T = any> {
  data: T,
}

function InfoListCmp<T = Record<string, string>>({data}: Props<T>): VNode {
  if (Object.keys(data) <= 0) {
    return <></>;
  }

  return <dl class={classes.infoList}>
    {Object.entries(data).map(([key, value]) => {
      return (
        <>
          <dt class={classes.dt}>{key}:</dt>
          <dd class={classes.dd}>{value.toString()}</dd>
        </>
      )
    })}
  </dl>;
}

export const InfoList = InfoListCmp as typeof InfoListCmp;
