import {login, register, AuthData} from 'authzn-sdk'
import './app.css'
import {useState} from 'preact/hooks';

export const App = () => {
  const [user, setUser] = useState<AuthData | null>(null);

  const handleRegister = async () => {
    const authUser = await register();
    console.log('authUser', authUser);
    setUser(authUser)
  }

  const handleLogin = async () => {
    const authUser = await login();
    console.log('authUser', authUser);
    setUser(authUser)
  }

  return (
    <>
      <h1>Authzn Demo</h1>
      {!user && <div class="card">
        <button onClick={handleRegister}>
          Register
        </button>
        Already have an account?
        <button onClick={handleLogin}>
          Login
        </button>
      </div>
      }
      {user && (<p>Hi <b>{user.username}</b></p>)}
      <p class="read-the-docs">
        This is a demo page, showcasing the <b>authzn-sdk</b> library
      </p>
    </>
  )
}
