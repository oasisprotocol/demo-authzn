import {login, register, AuthData} from 'authzn-sdk'
import './app.css'
import {useState} from 'preact/hooks';
import {WalletBalance} from "./components/WalletBalance";
import {TopUpButton} from "./components/TopUpButton";
import {WalletAddress} from "./components/WalletAddress";
import {SendTransactionForm} from "./components/SendTransactionForm";

export const App = () => {
  const [user, setUser] = useState<AuthData | null>(null);

  const handleRegister = async () => {
    const authUser = await register();
    setUser(authUser)
  }

  const handleLogin = async () => {
    const authUser = await login();
    setUser(authUser)
  }

  return (
    <>
      <h1>Authzn Demo</h1>
      <div className="card">
        {!user && <>
          <button onClick={handleRegister}>
            Register
          </button>
          Already have an account?
          <button onClick={handleLogin}>
            Login
          </button>
        </>
        }
        {user && (
          <>
            <div>
              <div>
                <p>
                  Hi <b>{user.username}</b>
                </p>
                <hr/>
                <p>
                  Your address:&nbsp;<WalletAddress address={user.address}/>
                  <br/>
                  Your balance:&nbsp;<WalletBalance address={user.address}/>
                </p>
                <hr/>
              </div>
              <div>
                <TopUpButton>
                  <hr/>
                </TopUpButton>
              </div>
            </div>
            <div>
              <SendTransactionForm senderAddress={user.address}/>
            </div>
          </>
        )}
      </div>
      <p class="read-the-docs">
        This is a demo page, showcasing the <b>authzn-sdk</b> library
      </p>
    </>
  )
}
