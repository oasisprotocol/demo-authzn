import classes from "./index.module.css";
import {FunctionComponent} from "preact";

export type MessageType = 'success' | 'error' | 'info';

interface Props {
  type: MessageType;
}

export const Message: FunctionComponent<Props> = ({type, children}) => {
  return <div class={[classes.message, classes[type]].join(' ')}>
    {children}
  </div>;
};
