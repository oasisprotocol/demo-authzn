import {createContext, FunctionComponent, JSX} from "preact";
import {useContext, useEffect, useState} from "preact/hooks";
import {ethers} from "ethers";
import * as sapphire from "@oasisprotocol/sapphire-paratime";
import {NetworkDefinition, NETWORKS} from "../networks";
import {useConfig} from "./ConfigProvider";
import {WebAuthNExample__factory, WebAuthNExample} from "demo-authzn-backend";

export interface EthWallet {
  chainId: number;
  network?: NetworkDefinition;
}

interface EthereumProviderState {
  isConnected: boolean;
  ethProvider: ethers.JsonRpcProvider | null,
  sapphireEthProvider: (ethers.JsonRpcProvider & sapphire.SapphireAnnex) | null;
  webAuthNProvider: WebAuthNExample | null;
  wallet: EthWallet | null;
}

interface EthereumProviderContext {
  readonly state: EthereumProviderState;
}

const ethereumProviderInitialState: EthereumProviderState = {
  isConnected: false,
  ethProvider: null,
  sapphireEthProvider: null,
  webAuthNProvider: null,
  wallet: null,
}

export const EthereumContext = createContext<EthereumProviderContext>({} as EthereumProviderContext)

export const EthereumContextProvider: FunctionComponent = ({children}) => {
  const {state: {sapphireChainId, sapphireJsonRpc, webAuthContract}} = useConfig()

  const [state, setState] = useState<EthereumProviderState>({
    ...ethereumProviderInitialState
  })

  const _getNetwork = (chainId: number) => {
    if (chainId in NETWORKS)
      return NETWORKS[chainId]

    throw new Error('[EthereumContext] Unable to find the chain ID in the config!');
  }

  useEffect(() => {
    if (!sapphireChainId || !sapphireJsonRpc) {
      return;
    }

    const network = _getNetwork(sapphireChainId);

    try {
      const ethProvider = new ethers.JsonRpcProvider(sapphireJsonRpc);
      const sapphireEthProvider = sapphire.wrap(ethProvider);
      const webAuthNProvider = WebAuthNExample__factory.connect(webAuthContract, sapphireEthProvider);

      setState(prevState => ({
        ...prevState,
        isConnected: true,
        wallet: {
          chainId: sapphireChainId,
          network,
        },
        ethProvider,
        sapphireEthProvider,
        webAuthNProvider
      }))
    } catch (ex) {
      setState(prevState => ({
        ...prevState,
        isConnected: false,
      }));

      throw new Error('[EthereumContext] Unable to initialize providers!');
    }
  }, [sapphireChainId, sapphireJsonRpc])

  const providerState: EthereumProviderContext = {
    state,
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
