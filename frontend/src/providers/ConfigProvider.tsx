import {createContext, FunctionComponent, JSX} from "preact";
import {useContext, useEffect, useState} from "preact/hooks";

export interface AppConfig {
  sapphireJsonRpc: string;
  webAuthContract: string;
  sapphireChainId: number;
  totpContract: string;
}

interface ConfigProviderState extends AppConfig {
}

interface ConfigProviderContext {
  readonly state: ConfigProviderState;
}

const configProviderInitialState: ConfigProviderState = {
  sapphireJsonRpc: '',
  sapphireChainId: -1,
  totpContract: '',
  webAuthContract: ''
}

export const ConfigContext = createContext<ConfigProviderContext>({} as ConfigProviderContext)

export const ConfigContextProvider: FunctionComponent = ({children}) => {
  const [state, setState] = useState<ConfigProviderState>({
    ...configProviderInitialState
  })

  useEffect(() => {
    const {
      VITE_SAPPHIRE_JSONRPC,
      VITE_SAPPHIRE_CHAIN_ID,
      VITE_TOTP_CONTRACT,
      VITE_WEBAUTH_ADDR
    } = import.meta.env;

    setState({
      sapphireJsonRpc: VITE_SAPPHIRE_JSONRPC,
      webAuthContract: VITE_WEBAUTH_ADDR,
      totpContract: VITE_TOTP_CONTRACT,
      sapphireChainId: parseInt(VITE_SAPPHIRE_CHAIN_ID, 16)
    })
  }, [])

  const providerState: ConfigProviderContext = {
    state,
  }

  return (
    <ConfigContext.Provider value={providerState}>
      {children}
    </ConfigContext.Provider>
  )
}

export const useConfig = () => {
  const value = useContext(ConfigContext);
  if (value === undefined) {
    throw new Error("[useConfig] Component not wrapped within a Provider");
  }

  return value;
}
