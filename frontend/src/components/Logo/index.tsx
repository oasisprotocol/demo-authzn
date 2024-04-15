import { FunctionComponent } from 'preact';
import classes from './index.module.css';

const src = new URL('/Network-Logo-White.svg', import.meta.url).href;

export const Logo: FunctionComponent = () => (
  <img class={classes.logo} src={src} alt="Oasis Network logo" />
);
