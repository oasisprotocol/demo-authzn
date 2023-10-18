import {Logo} from "../Logo";
import classes from "./index.module.css";
import {FunctionComponent} from "preact";

export const Page: FunctionComponent = ({children}) => {
  return <div class={classes.page}>
    <header class={classes.header}>
      <Logo/>
    </header>
    <main>{children}</main>
  </div>;
};
