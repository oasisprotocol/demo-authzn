import dotenv from 'dotenv';

const DEFAULT_TIMEOUT = 300000; // 5min

let authOrigin = 'http://localhost:5173';
if (globalThis.process) {
  dotenv.config({override: true});

  authOrigin = globalThis.process.env.BASE_AUTH_URL;
}

declare global {
  interface WindowEventMap {
    [AUTHZN_EVENTS.LOGIN]: CustomEvent
    [AUTHZN_EVENTS.REGISTER]: CustomEvent
    [AUTHZN_EVENTS.SEND_TRANSACTION]: CustomEvent
  }
}

interface RegisterData {
  username: string;
}

enum AUTHZN_EVENTS {
  LOGIN = 'login',
  REGISTER = 'register',
  SEND_TRANSACTION = 'sendTransaction'
}

let windowObjectReference = null;
let previousUrl = null;

const handleMessage = (event: MessageEvent, eventType?: 'register' | 'login' | 'sendTransaction') => {
  if (event.origin !== authOrigin) {
    return false;
  }
  const {data} = event;
  const urlParams = new URLSearchParams(data);

  switch (eventType) {
    case AUTHZN_EVENTS.LOGIN: {
      const username = urlParams.get('username');

      const loginEvent = new CustomEvent(AUTHZN_EVENTS.LOGIN, {detail: {username}});
      window.dispatchEvent(loginEvent);

      return;
    }
    case AUTHZN_EVENTS.REGISTER: {
      const username = urlParams.get('username');

      const registerEvent = new CustomEvent(AUTHZN_EVENTS.REGISTER, {detail: {username}});
      window.dispatchEvent(registerEvent);

      return;
    }

    default: {

    }
  }
}

const register = async (url = `${authOrigin}/register?origin=${window.location.origin}`, name = 'Register AuthNZ'): Promise<RegisterData> => {
  window.removeEventListener('message', handleMessage);
  const strWindowFeatures =
    'toolbar=no, menubar=no, width=1280, height=700, top=100, left=100';

  if (windowObjectReference === null || windowObjectReference.closed) {
    windowObjectReference = window.open(url, name, strWindowFeatures);
  } else if (previousUrl !== url) {
    windowObjectReference = window.open(url, name, strWindowFeatures);
    windowObjectReference.focus();
  } else {
    windowObjectReference.focus();
  }

  window.addEventListener('message', event => handleMessage(event, AUTHZN_EVENTS.REGISTER), false);
  previousUrl = url;

  return new Promise((resolve, reject) => {
    const resolveRegisterEvent = (e: CustomEvent) => {
      window.removeEventListener(AUTHZN_EVENTS.REGISTER, resolveRegisterEvent);
      clearInterval(t);
      resolve(e.detail);
    }

    const t = setTimeout(() => {
      window.removeEventListener(AUTHZN_EVENTS.REGISTER, resolveRegisterEvent);

      if (windowObjectReference) {
        windowObjectReference.close();
      }

      reject('Register event timed out!');
    }, DEFAULT_TIMEOUT);

    window.addEventListener(AUTHZN_EVENTS.REGISTER, resolveRegisterEvent);
  })
}


export {register}
