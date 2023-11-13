const DEFAULT_TIMEOUT = 300000; // 5min

const {VITE_BASE_AUTH_URL} = import.meta.env;

let authOrigin = VITE_BASE_AUTH_URL ?? 'https://playground.oasis.io';

declare global {
  interface WindowEventMap {
    [AUTHZN_EVENTS.LOGIN]: CustomEvent
    [AUTHZN_EVENTS.REGISTER]: CustomEvent
    [AUTHZN_EVENTS.SIGN]: CustomEvent
  }
}

export interface AuthData {
  username: string;
  address: string;
}

export interface SignData {
  signedTransaction: string;
}

enum AUTHZN_EVENTS {
  LOGIN = 'login',
  REGISTER = 'register',
  SIGN = 'sign'
}

let windowObjectRef: WindowProxy | null = null;
let previousUrl: string | null = null;

const handleMessage = (event: MessageEvent, eventType?: AUTHZN_EVENTS) => {
  if (event.origin !== authOrigin) {
    return false;
  }
  const {data} = event;
  const urlParams = new URLSearchParams(data);

  if(urlParams.get('target') !== 'authzn-popup') {
    return false;
  }

  switch (eventType) {
    case AUTHZN_EVENTS.LOGIN:
    case AUTHZN_EVENTS.REGISTER: {
      const username = urlParams.get('username');
      const address = urlParams.get('address');

      const authEvent = new CustomEvent(eventType, {detail: {username, address}});
      window.dispatchEvent(authEvent);

      return;
    }
    case AUTHZN_EVENTS.SIGN: {
      const signedTransaction = urlParams.get('tx');

      const signEvent = new CustomEvent(eventType, {detail: {signedTransaction}});
      window.dispatchEvent(signEvent);

      return;
    }


    default: {

    }
  }
}

const handlePopup = <T = any>(eventType: AUTHZN_EVENTS, searchObj: Record<string, string> = {}): Promise<T> => {
  const searchObjWithOrigin = {
    ...searchObj,
    origin: window.location.origin
  };

  const searchParams = new URLSearchParams(searchObjWithOrigin).toString();
  const url = `${authOrigin}/authzn/#/${eventType}?${searchParams}`;
  const name = `AuthNZ - ${eventType}`;

  window.removeEventListener('message', handleMessage);
  const strWindowFeatures =
    'toolbar=no, menubar=no, width=1280, height=800, top=100, left=100';

  if (windowObjectRef === null || windowObjectRef.closed) {
    windowObjectRef = window.open(url, name, strWindowFeatures);
  } else if (previousUrl !== url) {
    windowObjectRef = window.open(url, name, strWindowFeatures);
    windowObjectRef?.focus();
  } else {
    windowObjectRef.focus();
  }

  window.addEventListener('message', event => handleMessage(event, eventType), false);
  previousUrl = url;

  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      window.removeEventListener(eventType, resolveRegisterEvent);

      if (windowObjectRef) {
        windowObjectRef.close();
      }

      reject('Register event timed out!');
    }, DEFAULT_TIMEOUT);

    const resolveRegisterEvent = (e: CustomEvent) => {
      window.removeEventListener(eventType, resolveRegisterEvent);
      clearInterval(t);
      resolve(e.detail);
    }

    window.addEventListener(eventType, resolveRegisterEvent);
  });
}

const register = async (): Promise<AuthData> => {
  return handlePopup<AuthData>(AUTHZN_EVENTS.REGISTER);
}

const login = async (): Promise<AuthData> => {
  return handlePopup<AuthData>(AUTHZN_EVENTS.LOGIN);
}

const sign = async (unSignedTx: string): Promise<SignData> => {
  return handlePopup<SignData>(AUTHZN_EVENTS.SIGN, {
    unSignedTx
  });
}

export {register, login, sign}
