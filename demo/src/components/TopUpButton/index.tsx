import {FunctionComponent, JSX} from "preact";
import {Constants} from "../../utils/constants";
import {useConfig} from "../../providers/ConfigProvider";

export const TopUpButton: FunctionComponent = ({children}) => {
  const {state: {sapphireChainId}} = useConfig();

  const handleTopUp = async () => {
    window.open(Constants.TESTNET_SAPPHIRE_FAUCET_URL, '_blank', 'noopener,noreferrer,resizable');
  }

  if (sapphireChainId !== 23295) {
    return <></>;
  }

  return <>
    <button onClick={handleTopUp}>
      Top up your balance
    </button>
    {children}
  </>;
};
