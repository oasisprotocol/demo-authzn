import {FunctionComponent, JSX} from "preact";
import {useMemo, useState} from "preact/hooks";
import {Message, MessageType} from "../Message";
import classes from "./index.module.css";
import {BigNumber, utils} from "ethers";
import {useEthereum} from "../../providers/EthereumProvider";
import {sign} from 'authzn-sdk'
import {Constants} from "../../utils/constants";

interface Props {
  senderAddress: string;
}

interface SendTransactionFormData {
  to: string;
  amount: string;
}

export const SendTransactionForm: FunctionComponent<Props> = ({senderAddress}) => {
  const {state: {sapphireEthProvider}, prepareTransferTransaction, broadcastTxToNetwork} = useEthereum();

  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [state, setState] = useState<SendTransactionFormData>({to: '', amount: ''});
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [status, setStatus] = useState<{ type: MessageType, value: string }>({
    type: 'success',
    value: ''
  });
  const [signedTransaction, setSignedTransaction] = useState('');

  const isValidForm = useMemo(() => {
    const {to, amount} = state;

    if (!to) {
      setStatus({
        type: 'error',
        value: 'Recipient is required!'
      })

      return false;
    }

    if (!utils.isAddress(to)) {
      setStatus({
        type: 'error',
        value: 'Not a valid recipient address!'
      })

      return false;
    }

    if (to === senderAddress) {
      setStatus({
        type: 'error',
        value: 'Recipient address should differ your own address!'
      })

      return false;
    }

    if (!amount) {
      setStatus({
        type: 'error',
        value: 'Amount is required!'
      })

      return false;
    }

    setStatus({
      type: 'success',
      value: ''
    })

    return true;
  }, [state])

  const handleInputChange = (e: JSX.TargetedEvent<HTMLInputElement, KeyboardEvent>) => {
    if (e.target instanceof HTMLInputElement) {
      setState(state => ({
        ...state,
        [e.target.name]: e.target.value
      }));
    }
  }

  const handleFormSubmit = async (e: JSX.TargetedEvent<HTMLFormElement, SubmitEvent>) => {
    e.preventDefault();

    if (!isDirty) {
      setIsDirty(true);
    }

    if (!isValidForm) {
      return;
    }

    setIsLoading(true);

    setStatus({
      type: 'info',
      value: 'Please wait...'
    })

    const {amount, to} = state;

    const balance = (await sapphireEthProvider?.getBalance(senderAddress)) ?? BigNumber.from(0);
    const amountBn = BigNumber.from(amount)
    if (balance.lt(amountBn)) {
      setStatus({
        type: 'error',
        value: 'Insufficient balance!'
      })
    }

    const unSignedTx = await prepareTransferTransaction(senderAddress, to, amount);

    try {
      const {signedTransaction} = await sign(unSignedTx);

      setSignedTransaction(signedTransaction)

      setStatus({
        type: 'success',
        value: ''
      })
    } catch (ex) {
      setStatus({
        type: 'error',
        value: 'Signing failed!'
      })
    } finally {
      setIsLoading(false);
    }
  }

  const handleTxBroadcastToNetwork = async () => {
    setIsLoading(true);

    setStatus({
      type: 'info',
      value: 'Please wait...'
    })

    try {
      const tx = await broadcastTxToNetwork(signedTransaction);

      setTxHash(tx.hash);

      console.log('Broadcasted tx:', tx);
    } catch (ex) {
      console.error(ex);
    } finally {
      setStatus({
        type: 'success',
        value: 'Transaction successfully completed!'
      })

      setIsLoading(false);
    }
  }

  const handleNavigateToExplorer = () => {
    window.open(`${Constants.EXPLORER_SAPPHIRE_TESTNET_TX_URL}${txHash}`, '_blank', 'noopener,noreferrer');
  }

  return <div class={classes.sendTransactionForm}>
    <h2>Transfer</h2>
    {!signedTransaction && (<div>
      <form class={classes.form} onSubmit={handleFormSubmit} novalidate>
        <div>
          <input type="text" name="to" placeholder="Recipient" value={state.to} onInput={handleInputChange}/>
        </div>
        <div>
          <input type="number" name="amount" placeholder="Amount" value={state.amount} min="1" step="1"
                 onInput={handleInputChange}/>
        </div>

        <div class={classes.submit}>
          {isDirty && (<Message type={status.type}>
            {status.value}
          </Message>)}

          <button type="submit" disabled={isLoading}>Send</button>
        </div>
      </form>
    </div>)}
    {signedTransaction && !txHash && (<div>
      <p>In order for the transaction to be completed, you need to first broadcast it to the network, by clicking the
        button bellow</p>

      <div className={classes.submit}>
        {isDirty && (<Message type={status.type}>
          {status.value}
        </Message>)}

        <button type="button" onClick={handleTxBroadcastToNetwork} disabled={isLoading}>Broadcast to network</button>
      </div>
    </div>)}
    {txHash && (<div>
      <p>Transaction has been completed with hash <b>{txHash}</b></p>
      <button type="button" onClick={handleNavigateToExplorer} disabled={isLoading}>Navigate to explorer</button>
    </div>)}
  </div>;
};
