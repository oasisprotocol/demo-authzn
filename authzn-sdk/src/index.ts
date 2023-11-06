const DEFAULT_TIMEOUT = 300000; // 5min

const { VITE_BASE_AUTH_URL } = import.meta.env;

let authOrigin = VITE_BASE_AUTH_URL ?? 'https://authnz.neocities.org';

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

let windowObjectRef: WindowProxy | null = null;
let previousUrl: string | null = null;

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

const register = async (url = `${authOrigin}/#/register?origin=${window.location.origin}`, name = 'Register AuthNZ'): Promise<RegisterData> => {
  window.removeEventListener('message', handleMessage);
  const strWindowFeatures =
    'toolbar=no, menubar=no, width=1280, height=700, top=100, left=100';

  if (windowObjectRef === null || windowObjectRef.closed) {
    windowObjectRef = window.open(url, name, strWindowFeatures);
  } else if (previousUrl !== url) {
    windowObjectRef = window.open(url, name, strWindowFeatures);
    windowObjectRef?.focus();
  } else {
    windowObjectRef.focus();
  }

  window.addEventListener('message', event => handleMessage(event, AUTHZN_EVENTS.REGISTER), false);
  previousUrl = url;

  return new Promise<RegisterData>((resolve, reject) => {
    const t = setTimeout(() => {
      window.removeEventListener(AUTHZN_EVENTS.REGISTER, resolveRegisterEvent);

      if (windowObjectRef) {
        windowObjectRef.close();
      }

      reject('Register event timed out!');
    }, DEFAULT_TIMEOUT);

    const resolveRegisterEvent = (e: CustomEvent) => {
      window.removeEventListener(AUTHZN_EVENTS.REGISTER, resolveRegisterEvent);
      clearInterval(t);
      resolve(e.detail);
    }

    window.addEventListener(AUTHZN_EVENTS.REGISTER, resolveRegisterEvent);
  });
}


export {register}
