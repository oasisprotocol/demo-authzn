import {FunctionComponent, VNode} from "preact";
import classes from './index.module.css'

interface Props {
  left: VNode,
  right: VNode
}

export const Layout: FunctionComponent<Props> = ({left, right}) => {
  return <div class={classes.layout}>
    <div class={classes.left}>
      {left}
    </div>
    <div>
      {right}
    </div>
  </div>;
};
