import {FunctionComponent} from "preact";
import Router from "preact-router";
import {createHashHistory} from "history";
import {Register} from "./pages/Register";
import {Login} from "./pages/Login";
import {Sign} from "./pages/Sign";
import {Redirect} from "./components/Redirect";
import {Page} from "./components/Page";
import {WebAuthNContextProvider} from "./providers/WebAuthNProvider";
import {ConfigContextProvider} from "./providers/ConfigProvider";
import {EthereumContextProvider} from "./providers/EthereumProvider";

export const App: FunctionComponent = () => {
  return (
    <ConfigContextProvider>
      <EthereumContextProvider>
        <WebAuthNContextProvider>
          <Page>
            <Router history={createHashHistory()}>
              <Register path="/register"/>
              <Login path="/login"/>
              <Sign path="/sign"/>
              <Redirect path="/" to="/register"/>
            </Router>
          </Page>
        </WebAuthNContextProvider>
      </EthereumContextProvider>
    </ConfigContextProvider>
  )
}
