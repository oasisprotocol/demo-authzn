import { register } from 'authzn-sdk'
import './app.css'

export const App = () => {
  const handleRegister = async () => {
    const { username } = await register();
    console.log(username);
  }

  const handleLogin = () => {

  }

  return (
    <>
      <h1>Authzn Demo</h1>
      <div class="card">
        <button onClick={handleRegister}>
          Register
        </button>
        Already have an account?
        <button onClick={handleLogin}>
          Login
        </button>
      </div>
      <p class="read-the-docs">
        This is a demo page, showcasing the <b>authzn-sdk</b> library
      </p>
    </>
  )
}
