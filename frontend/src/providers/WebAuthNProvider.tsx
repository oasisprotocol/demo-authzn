import {createContext, FunctionComponent, JSX} from "preact";
import {useContext, useState} from "preact/hooks";
import {pbkdf2Sync} from "pbkdf2";
import {BytesLike, toBeArray, ZeroHash} from "ethers";
import {useEthereum} from "./EthereumProvider";
import {credentialCreate} from "demo-authzn-backend/src/webauthn.ts";
import {
  CosePublicKeyStruct
} from "demo-authzn-backend/dist/typechain-types/contracts/WebAuthNExample.sol/WebAuthNExample";
import {TransactionReceipt} from "ethers/src.ts/providers/provider";

const _usernameHashesCache: Record<string, Buffer> = {};

interface WebAuthNProviderState {
  salt: UInt8Array | null;
}

interface WebAuthNProviderContext {
  readonly state: WebAuthNProviderState;
  register: (username: string) => Promise<TransactionReceipt | false | null>;
}

const webAuthNProviderInitialState: WebAuthNProviderState = {
  salt: null
}

export const WebAuthNContext = createContext<WebAuthNProviderContext>({} as WebAuthNProviderContext)

export const WebAuthNContextProvider: FunctionComponent = ({children}) => {
  const {state: {webAuthNProvider, sapphireEthProvider}} = useEthereum()

  const [state, setState] = useState<WebAuthNProviderState>({
    ...webAuthNProviderInitialState
  })

  const _getSalt = async () => {
    if (state.salt) {
      return state.salt;
    }

    const salt = toBeArray(await webAuthNProvider.salt())

    setState(prevState => ({
      ...prevState,
      salt
    }))

    return salt;
  }

  const _getHashedUsername = async (username: string): Promise<Buffer> => {
    // Cache pbkdf2 hashed usernames locally
    if (username in _usernameHashesCache) {
      return _usernameHashesCache[username];
    }

    const start = new Date();
    const result = pbkdf2Sync(username, await _getSalt(), 100_000, 32, 'sha256');
    const end = new Date();
    console.log('pbkdf2', username, '=', end.getTime() - start.getTime(), 'ms');
    _usernameHashesCache[username] = result;
    return result;
  }

  const _getUserExists = async (username: string): Promise<boolean> => {
    const hashedUsername = await _getHashedUsername(username)
    if (hashedUsername) {
      return await webAuthNProvider.userExists(hashedUsername as BytesLike)
    }

    return Promise.reject(new Error('[WebAuthNProvider] Unable to check if the user exists!'))
  }

  const _getCredentials = async (
    {
      id,
      username,
      hashedUsername
    }: { id: string, username: string, hashedUsername: BufferSource }) => {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    return await credentialCreate({
      id,
      name: "Sapphire-Auth[ZN]",
    }, {
      id: hashedUsername,
      name: username,
      displayName: username,
    }, challenge)
  }

  const _sendRegisterTx = async (
    {hashedUsername, credentialId, pubkey, optionalPassword = ZeroHash}:
      {
        hashedUsername: BytesLike;
        credentialId: BytesLike;
        pubkey: CosePublicKeyStruct;
        optionalPassword?: BytesLike;
      }
  ): Promise<TransactionReceipt> => {
    if (!sapphireEthProvider || !webAuthNProvider) {
      throw new Error('[WebAuthNProvider] Unable to send register transactions, due to provider not being initialized!')
    }

    const gasPrice = (await sapphireEthProvider.getFeeData()).gasPrice;
    const gasPayingAddress = await webAuthNProvider.gaspayingAddress();
    const nonce = await sapphireEthProvider.getTransactionCount(gasPayingAddress);
    const signedTx = await webAuthNProvider.gasless_registerECES256P256(
      {
        hashedUsername,
        credentialId,
        pubkey,
        optionalPassword
      },
      nonce, gasPrice);

    // Then send the returned transaction and wait for it to be confirmed
    const txHash = await sapphireEthProvider.send('eth_sendRawTransaction', [signedTx]) as string;
    await sapphireEthProvider.waitForTransaction(txHash);
    const tx = (await sapphireEthProvider.getTransaction(txHash))!;
    return await tx.wait();
  }

  const register: WebAuthNProviderContext['register'] = async (username: string): Promise<TransactionReceipt | false | null> => {
    const isUsernameAvailable = !(await _getUserExists(username));

    if (isUsernameAvailable) {
      const hashedUsername = await _getHashedUsername(username);
      const credentials = await _getCredentials({
        id: window.location.hostname,
        username,
        hashedUsername: hashedUsername as BufferSource,
      });

      return await _sendRegisterTx({
        hashedUsername: hashedUsername as Uint8Array,
        credentialId: credentials.id,
        pubkey: credentials.ad.attestedCredentialData!.credentialPublicKey!,
      });
    } else {
      return false;
    }
  }

  const providerState: WebAuthNProviderContext = {
    state,
    register
  }

  return (
    <WebAuthNContext.Provider value={providerState}>
      {children}
    </WebAuthNContext.Provider>
  )
}

export const useWebAuthN = () => {
  const value = useContext(WebAuthNContext);
  if (value === undefined) {
    throw new Error("[useWebAuthN] Component not wrapped within a Provider");
  }

  return value;
}
