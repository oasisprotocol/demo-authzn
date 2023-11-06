import {register} from 'authzn-sdk'
import './app.css'
import {useState} from 'preact/hooks';

export const App = () => {
  const [user, setUser] = useState('')

  const handleRegister = async () => {
    const {username} = await register();
    setUser(username)
  }

  const handleLogin = () => {

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
      {user && (<p>Hi <b>{user}</b></p>)}
      <p class="read-the-docs">
        This is a demo page, showcasing the <b>authzn-sdk</b> library
      </p>
    </>
  )
}
