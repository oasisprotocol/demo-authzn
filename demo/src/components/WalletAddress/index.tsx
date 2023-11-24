import {FunctionComponent, JSX} from "preact";
import {utils} from "ethers";
import classes from './index.module.css'

interface Props {
  address: string;
}

export const WalletAddress: FunctionComponent<Props> = ({address}) => {
  return <span>
    {address && <b class={classes.address}>{utils.getAddress(address)}</b>}
    {!address && '¯\\_(ツ)_/¯'}
  </span>;
};
