import {createContext, FunctionComponent, JSX} from "preact";
import {useContext, useEffect, useState} from "preact/hooks";
import {BigNumber, ethers, utils} from "ethers";
import * as sapphire from "@oasisprotocol/sapphire-paratime";
import {useConfig} from "./ConfigProvider";
import {VoidSigner} from "@ethersproject/abstract-signer";

type TransactionResponse = ReturnType<Awaited<Provider.getTransaction>>;

interface EthereumProviderState {
  isConnected: boolean;
  ethProvider: ethers.JsonRpcProvider | null,
  sapphireEthProvider: (ethers.providers.JsonRpcProvider & sapphire.SapphireAnnex) | null;
}

interface EthereumProviderContext {
  readonly state: EthereumProviderState;
  prepareTransferTransaction: (from: string, to: string, value: string) => Promise<string>;
  broadcastTxToNetwork: (signedTx: string) => Promise<TransactionResponse>;
}

const ethereumProviderInitialState: EthereumProviderState = {
  isConnected: false,
  ethProvider: null,
  sapphireEthProvider: null,
}

export const EthereumContext = createContext<EthereumProviderContext>({} as EthereumProviderContext);

export const EthereumContextProvider: FunctionComponent = ({children}) => {
  const {state: {sapphireChainId, sapphireJsonRpc, sapphireFaucetWalletPrivateKey}} = useConfig();

  const [state, setState] = useState<EthereumProviderState>({
    ...ethereumProviderInitialState
  });

  useEffect(() => {
    if (!sapphireChainId || !sapphireJsonRpc) {
      return;
    }

    try {
      const ethProvider = new ethers.providers.JsonRpcProvider(sapphireJsonRpc);
      const sapphireEthProvider = sapphire.wrap(ethProvider);

      setState(prevState => ({
        ...prevState,
        isConnected: true,
        ethProvider,
        sapphireEthProvider,
      }));
    } catch (ex) {
      setState(prevState => ({
        ...prevState,
        isConnected: false,
      }));

      throw new Error('[EthereumContext] Unable to initialize providers!');
    }
  }, [sapphireChainId, sapphireJsonRpc])

  const _getSapphireProvider = () => {
    const {sapphireEthProvider} = state;
    if (!sapphireEthProvider) {
      throw new Error('[EthereumContext] Provider/s not initialized!');
    }

    return sapphireEthProvider;
  }

  const prepareTransferTransaction = async (from: string = ethers.constants.AddressZero, to: string, amount: string): Promise<string> => {
    const sapphireEthProvider = _getSapphireProvider();

    const signer = new VoidSigner(from, sapphireEthProvider);

    const txRequest = await signer.populateTransaction({
      from,
      to,
      value: utils.parseUnits(amount, 'ether'),
      gasLimit: 1000000,
    });

    const stripBNTx = Object.entries(txRequest).reduce((acc, entry ) => {
      const [key, value] = entry;

      const modValue = BigNumber.isBigNumber(value) ? value.toString() : value;

      return {
        ...acc,
        [key]: modValue
      }
    }, {})

    return JSON.stringify(stripBNTx);
  }

  const broadcastTxToNetwork = async (signedTx: string): Promise<TransactionResponse> => {
    const sapphireEthProvider = _getSapphireProvider();

    const txHash = await sapphireEthProvider.send('eth_sendRawTransaction', [signedTx]);
    await sapphireEthProvider.waitForTransaction(txHash);
    return await sapphireEthProvider.getTransaction(txHash);
  }

  const providerState: EthereumProviderContext = {
    state,
    prepareTransferTransaction,
    broadcastTxToNetwork,
  }

  return (
    <EthereumContext.Provider value={providerState}>
      {children}
    </EthereumContext.Provider>
  )
}

export const useEthereum = () => {
  const value = useContext(EthereumContext);
  if (value === undefined) {
    throw new Error("[useEthereum] Component not wrapped within a Provider");
  }

  return value;
}
