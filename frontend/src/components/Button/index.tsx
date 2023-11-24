import {FunctionComponent, JSX} from "preact";
import {ButtonArrow} from "./ButtonArrow";
import classes from './index.module.css'

interface Props {
  type?: HTMLButtonElement['type'];
  className?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onclick?: (e?: JSX.TargetedEvent<HTMLButtonElement, MouseEvent>) => void;
}

export const Button: FunctionComponent<Props> = ({type, className, disabled, fullWidth, onclick, children}) => {
  const handleClick = (e?: JSX.TargetedEvent<HTMLButtonElement, MouseEvent>) => {
    if(disabled) {
      return;
    }

    onclick?.(e);
  }

  return <button
    class={[...(className ? [className] : []), classes.button, ...(disabled ? [classes.buttonDisabled] : []), ...(fullWidth ? [classes.fullWidth] : [])].join(' ')}
    type={type} onClick={handleClick}>
    {children}
    <ButtonArrow color={disabled ? '#3333c9' : undefined}/>
  </button>;
};
