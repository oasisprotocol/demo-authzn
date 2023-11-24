import {FunctionComponent} from "preact";
import classes from './index.module.css'

export const Card: FunctionComponent = ({children}) => {
  return <div class={classes.card}>
    {children}
  </div>;
};
