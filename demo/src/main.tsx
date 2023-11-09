import {render} from 'preact'
import {App} from './App.tsx'
import './index.css'
import {ConfigContextProvider} from "./providers/ConfigProvider";
import {EthereumContextProvider} from "./providers/EthereumProvider";

render(
  <ConfigContextProvider>
    <EthereumContextProvider>
      <App/>
    </EthereumContextProvider>
  </ConfigContextProvider>,
  document.getElementById('app')!
)
