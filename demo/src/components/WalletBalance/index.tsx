import {FunctionComponent, JSX} from "preact";
import {useEffect, useState} from "preact/hooks";
import {BigNumber, utils} from "ethers";
import classes from './index.module.css'
import {useEthereum} from "../../providers/EthereumProvider";

interface Props {
  address: string;
  ticker?: string;
}

export const WalletBalance: FunctionComponent<Props> = ({address, ticker = 'ROSE'}) => {
  const [balance, setBalance] = useState<BigNumber | null>(null);
  const {state: {sapphireEthProvider}} = useEthereum();

  useEffect(() => {
    const fetchBalance = async () => {
      const _balance = (await sapphireEthProvider?.getBalance(address)) ?? null;

      setBalance(_balance);
    }

    fetchBalance();
  }, [address])

  return <span>
    {balance !== null && <><b class={classes.balance}>{`${utils.formatEther(balance)}`}</b> {ticker}</>}
    {balance === null && '¯\\_(ツ)_/¯'}
  </span>;
};
