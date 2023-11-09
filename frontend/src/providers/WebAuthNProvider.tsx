import {createContext, FunctionComponent, JSX} from "preact";
import {useContext, useState} from "preact/hooks";
import {pbkdf2Sync} from "pbkdf2";
import {BytesLike, sha256, toBeArray, toBeHex, toBigInt, ZeroHash} from "ethers";
import {useEthereum} from "./EthereumProvider";
import {credentialCreate, credentialGet} from "demo-authzn-backend/src/webauthn.ts";
import {
  CosePublicKeyStruct
} from "demo-authzn-backend/dist/typechain-types/contracts/WebAuthNExample.sol/WebAuthNExample";
import {TransactionReceipt} from "ethers/src.ts/providers/provider";
import {Account__factory} from "demo-authzn-backend/typechain-types/index.ts";
import {recoverAddress, TransactionLike} from "ethers";
import {EIP155Signer} from "demo-authzn-backend/dist/typechain-types/contracts/Account.sol/Account";

const _usernameHashesCache: Record<string, Buffer> = {};
const _usernameAddressCache: Record<string, [string, string]> = {};

interface WebAuthNProviderState {
  salt: UInt8Array | null;
}

interface WebAuthNProviderContext {
  readonly state: WebAuthNProviderState;
  register: (username: string) => Promise<TransactionReceipt | false | null>;
  login: (username: string) => Promise<boolean>;
  sign: (username: string, tx: TransactionLike) => Promise<string>;
  getAccountAddress: (username: string) => Promise<string>;
}

const webAuthNProviderInitialState: WebAuthNProviderState = {
  salt: null
}

export const WebAuthNContext = createContext<WebAuthNProviderContext>({} as WebAuthNProviderContext)

export const WebAuthNContextProvider: FunctionComponent = ({children}) => {
  const {state: {ethProvider, webAuthNProvider, sapphireEthProvider}} = useEthereum()

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

  const _getAccount = async (username: string): Promise<[string, string]> => {
    const hashedUsername = await _getHashedUsername(username)

    if (hashedUsername in _usernameAddressCache) {
      return _usernameAddressCache[hashedUsername];
    }

    if (hashedUsername) {
      const account = (await webAuthNProvider.getAccount(hashedUsername as BytesLike)).toArray();
      _usernameAddressCache[hashedUsername] = account;

      return account;
    }

    return Promise.reject(new Error('[WebAuthNProvider] Unable to retrieve account!'))
  }

  const getAccountAddress = async (username: string): Promise<string> => {
    const [, pubkeyAddr] = await _getAccount(username);
    return pubkeyAddr;
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

  const _verifyChallenge = async (calldata: string, username: string) => {
    if (!webAuthNProvider || !ethProvider) {
      throw new Error('[WebAuthNProvider] Unable to verify user, due to provider not being initialized!')
    }

    const network = await ethProvider.getNetwork();
    const chainId = network.chainId;

    const accountIdHex = (await webAuthNProvider.getAddress()).slice(2);
    const saltHex = toBeHex(toBigInt(await _getSalt() as Uint8Array), 32);

    const personalization = sha256('0x' + toBeHex(chainId!, 32).slice(2) + accountIdHex + saltHex.slice(2));
    const personalizedHash = sha256(personalization + sha256(calldata).slice(2));

    // Perform WebAuthN signing of challenge
    const challenge = toBeArray(personalizedHash);
    const hashedUsername = await _getHashedUsername(username);
    const credentialIds = await webAuthNProvider.credentialIdsByUsername(hashedUsername);
    const binaryCredentialIds = credentialIds.map((_) => toBeArray(_));
    const credentials = await credentialGet(binaryCredentialIds, challenge);

    const {credentialIdHashed, resp} = credentials;

    return await webAuthNProvider.proxyViewECES256P256(credentialIdHashed, resp, calldata);
  }

  const login = async (username: string): Promise<boolean> => {
    const isUsernameAvailable = !(await _getUserExists(username));

    if (isUsernameAvailable) {
      return false;
    }

    const ai = Account__factory.createInterface();
    const randStuff = crypto.getRandomValues(new Uint8Array(32));
    const calldata = ai.encodeFunctionData("sign", [randStuff]);

    const resp = await _verifyChallenge(calldata, username);
    const [decodedResp] = ai.decodeFunctionResult('sign', resp).toArray();
    const [r, s, v] = decodedResp.toArray();

    const recoveredAddress = recoverAddress(randStuff as BytesLike, {r, s, v});

    const pubkeyAddr = await getAccountAddress(username);
    return pubkeyAddr === recoveredAddress;
  }

  const signEIP155 = async (username: string, tx: UnsignedTransaction & { from: string }): Promise<any> => {
    const addressPublicAddress = await getAccountAddress(username);

    // TODO: Sapphire specific, for dummy from check
    const {from, ...restTx} = tx;
    if (addressPublicAddress !== from) {
      return Promise.reject('Malicious action has been detected! Aborting...');
    }

    const ai = Account__factory.createInterface();

    const calldata = ai.encodeFunctionData('signEIP155', [{
      ...restTx,
      data: restTx?.data ?? '0x',
    } as EIP155Signer.EthTxStruct]);

    const resp = await _verifyChallenge(calldata, username);
    const [signedTx] = ai.decodeFunctionResult('signEIP155', resp).toArray();

    return signedTx;
  }

  const providerState: WebAuthNProviderContext = {
    state,
    register,
    login,
    sign: signEIP155,
    getAccountAddress
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
