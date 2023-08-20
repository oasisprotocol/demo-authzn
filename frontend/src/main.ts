import { subscribe } from "exome";
import { sha256, toBeArray, toBeHex, toBigInt } from "ethers";
import { WebAuthNExample__factory } from "demo-authzn-backend";
import { pbkdf2Sync } from "pbkdf2"

import { EthProviders } from './ctx.ts'
import { credentialCreate, credentialGet } from './webauthn.ts';
import { Account__factory } from "demo-authzn-backend/typechain-types/index.ts";
import { EIP155Signer } from "demo-authzn-backend/typechain-types/contracts/lib/Account.sol/Account.ts";

// ------------------------------------------------------------------

export interface AppConfig {
  sapphireJsonRpc: string;
  webauthContract: string;
  sapphireChainId: number;
}

// ------------------------------------------------------------------

function setVisibility(x:HTMLElement, hidden:boolean|undefined) {
  x.style.visibility = hidden ? 'visible' : 'hidden';
}

function setDisabled(element:HTMLElement, disabled:boolean) {
  if( disabled ) {
    return element.setAttribute('disabled', 'disabled');
  }
  element.removeAttribute('disabled');
}

/**
 * Displays wallet connectivity status and allows you to connect etc.
 */
class WalletManager
{
  status = document.querySelector<HTMLSpanElement>('#wallet-status')!;
  network = document.querySelector<HTMLSpanElement>('#wallet-network')!;
  accounts = document.querySelector<HTMLSelectElement>('#wallet-accounts')!;
  connect = document.querySelector<HTMLButtonElement>('#wallet-connect')!;
  switch = document.querySelector<HTMLButtonElement>('#wallet-switch')!;

  constructor (private _providers:EthProviders, private _config:AppConfig) {
    subscribe(_providers, this.refresh.bind(this));
  }

  async attach () {
    this.connect.addEventListener('click', this._onConnectClick.bind(this));
    this.switch.addEventListener('click', this._onSwitchClick.bind(this));
    this.accounts.addEventListener('change', this._onAccounts.bind(this));
    this.refresh();
  }

  async _onSwitchClick () {
    this._providers.switchNetwork(this._config.sapphireChainId);
  }

  async _onConnectClick () {
    const providers = this._providers;
    if( ! providers.connected ) {
      await providers.connect();
    }
  }

  async _onAccounts () {
    for( const o of this.accounts.selectedOptions ) {
      const a = o.innerText;
      this._providers.selectAccount(a);
    }
  }

  refresh () {
    const p = this._providers;
    const w = p.wallet;
    const connected = p.connected;
    setDisabled(this.connect, connected);
    setVisibility(this.connect, !connected);
    setVisibility(this.switch, w && w.chainId !== this._config.sapphireChainId);

    this.status.innerText = connected ? 'Connected' : 'Not Connected';

    // Populate dropdown list of accounts
    this.accounts.innerHTML = '';
    if( p.accounts.length ) {
      for( let a of p.accounts ) {
        const e = document.createElement('option');
        e.innerText = a;
        if( a == p.account ) {
          e.setAttribute('selected', 'selected');
        }
        this.accounts.appendChild(e);
      }
      setDisabled(this.accounts, false);
      setVisibility(this.accounts, true);
    }
    else {
      setDisabled(this.accounts, true);
      setVisibility(this.accounts, false);
    }

    if( w ) {
      const name = w.network ? ` (${w.network.chainName})` : '';
      this.network.innerText = `Network: ${w.chainId}${name}`;
    }
  }
}

// ------------------------------------------------------------------

/**
 * Manages the username widgets
 * Checks if username is available
 * Shows spinner next to textbox
 * Shows error messages
 * Validates usernames etc.
 */
class UsernameManager
{
  usernameInput = document.querySelector<HTMLInputElement>('#webauthn-username')!;
  usernameCheck = document.querySelector<HTMLButtonElement>('#webauthn-username-check')!;
  usernameStatus = document.querySelector<HTMLSpanElement>('#webauthn-username-status')!;
  usernameSpinner = document.querySelector<HTMLImageElement>('#webauthn-username-spinner')!;

  private _usernameHashesCache: {[id:string]:Uint8Array} = {};
  private _salt: Uint8Array|null = null;

  constructor (private _providers:EthProviders, private _config: AppConfig) {
    subscribe(_providers, this._onProvidersUpdate.bind(this));
  }

  async salt () {
    if( this._salt === null ) { // Retirve contract salt only once
      this._salt = toBeArray(await this.readonlyContract.salt());
    }
    return this._salt;
  }

  async _onProvidersUpdate() {
    const disabled = ! this._providers.connected;
    setDisabled(this.usernameInput, disabled);
    setDisabled(this.usernameCheck, disabled);
  }

  get readonlyContract () {
    if( ! this._providers.swp ) {
      throw Error('Not connected!');
    }
    return WebAuthNExample__factory.connect(this._config.webauthContract, this._providers.swp);
  }

  async attach () {
    this.usernameCheck.addEventListener('click', this._onCheck.bind(this));
  }

  get username () {
    const x = this.usernameInput.value.toLowerCase();
    if( x.length ) {
      return x;
    }
  }

  async hashedUsername (username?: string) : Promise<Uint8Array> {
    if( ! username ) {
      username = this.username;
    }
    if( ! username ) {
      throw new Error('Cannot hash undefined username!');
    }
    if( username in this._usernameHashesCache ) { // Cache pbkdf2 hashed usernames locally
      return this._usernameHashesCache[username];
    }

    const start = new Date();
    const result = pbkdf2Sync(username, await this.salt(), 100_000, 32, 'sha256');
    const end = new Date();
    console.log('pbkdf2', username, '=', end.getTime() - start.getTime(), 'ms');
    this._usernameHashesCache[username] = result;
    return result;
  }

  async _userExists(username:string) {
    const h = await this.hashedUsername(username);
    if( h ) {
      return await this.readonlyContract.userExists(h);
    }
  }

  async _onCheck () {
    try {
      const available =  await this.checkUsername(false);
      if( available ) {
        this.usernameStatus.innerText = 'Available';
      }
    }
    catch(e:any) {
      this.usernameStatus.innerText = `Error: ${e}`;
    }
  }

  async checkUsername (mustExist:boolean) {
    this.usernameStatus.innerText = '...';
    setVisibility(this.usernameSpinner, true);
    try {
      const re = /^[a-zA-Z0-9_\.\-]+(@([a-zA-Z0-9\.\-]+))?$/;
      const username = this.username;
      if( ! username ) {
        this._finishCheckUsername('Required!');
        return false;
      }
      if( ! re.test(username) ) {
        return this._finishCheckUsername('Bad Chars!');
      }
      if( await this._userExists(username) ) {
        if( ! mustExist ) {
          return this._finishCheckUsername('Already Exists!');
        }
      }
      else if( mustExist ) {
        return this._finishCheckUsername("Doesn't Exist!");
      }
      return this._finishCheckUsername('', true);
    }
    finally {
      setVisibility(this.usernameSpinner, false);
    }
  }

  _finishCheckUsername(status:string, success?:boolean) {
    this.usernameStatus.innerText = status;
    if( ! success ) {
      this.usernameInput.focus();
    }
    return !!success;
  }
}

// ------------------------------------------------------------------

class WebAuthNManager
{
  registerButton = document.querySelector<HTMLButtonElement>('#webauthn-register-button')!;
  registerStatus = document.querySelector<HTMLSpanElement>('#webauthn-register-status')!;
  registerSpinner = document.querySelector<HTMLImageElement>('#webauthn-register-spinner')!;
  loginButton = document.querySelector<HTMLButtonElement>('#webauthn-login-button')!;
  loginStatus = document.querySelector<HTMLSpanElement>('#webauthn-login-status')!;
  loginSpinner = document.querySelector<HTMLImageElement>('#webauthn-login-spinner')!;

  testButton = document.querySelector<HTMLButtonElement>('#webauthn-test-button')!;
  testStatus = document.querySelector<HTMLSpanElement>('#webauthn-test-status')!;
  testSpinner = document.querySelector<HTMLImageElement>('#webauthn-test-spinner')!;

  usernameManager: UsernameManager;

  get readonlyContract () {
    if( ! this._providers.swp ) {
      throw Error('Not connected!');
    }
    return WebAuthNExample__factory.connect(this._config.webauthContract, this._providers.swp);
  }

  get signingContract () {
    if( ! this._providers.sws ) {
      throw Error('Not connected!');
    }
    return WebAuthNExample__factory.connect(this._config.webauthContract, this._providers.sws);
  }

  constructor(private _providers:EthProviders, private _config:AppConfig) {
    subscribe(_providers, this._onProvidersUpdate.bind(this));
    this.usernameManager = new UsernameManager(_providers, _config);
  }

  async _onProvidersUpdate () {
    const disabled = ! this._providers.connected;
    setDisabled(this.registerButton, disabled);
    setDisabled(this.loginButton, disabled);
    setDisabled(this.testButton, disabled);
  }

  async attach () {
    this.registerButton.addEventListener('click', this._onRegister.bind(this));
    this.loginButton.addEventListener('click', this._onLogin.bind(this));
    this.testButton.addEventListener('click', this._onTest.bind(this));
    await this.usernameManager.attach();
  }

  async _onRegister () {
    setVisibility(this.registerSpinner, true);
    try {
      if( await this.usernameManager.checkUsername(false) )
      {
        this.registerStatus.innerText = 'Requesting WebAuthN Creation';
        const username = this.usernameManager.username;
        if( ! username ) {
          throw new Error('requires username');
        }
        const hashedUsername = await this.usernameManager.hashedUsername();
        const challenge = crypto.getRandomValues(new Uint8Array(32));

        let cred;
        try {
          cred = await credentialCreate({
            name: "Sapphire-Auth[ZN]",
            id: window.location.hostname
          }, {
            id: hashedUsername,
            name: username,
            displayName: username
          }, challenge);
        }
        catch( e: any ) {
          this.registerStatus.innerText = `${e}`;
          return;
        }

        try {
          const tx = await this.signingContract.registerECES256P256(hashedUsername, cred.id, cred.ad.at!.credentialPublicKey!)
          this.registerStatus.innerText = `Registering (tx: ${tx.hash})`;
          const receipt = await tx.wait();
          this.registerStatus.innerText = `Registered (block: ${receipt!.blockNumber}, tx: ${tx.hash}, gas: ${receipt!.gasUsed})`;
        }
        catch( e:any ) {
          if( e.info && e.info.error ) {
            this.registerStatus.innerText = `${e.info.error.code}: ${e.info.error.message}`;
          }
          else {
            this.registerStatus.innerText = `${e}`;
          }
          return;
        }
      }
    }
    finally {
      setVisibility(this.registerSpinner, false);
    }
  }

  async _onLogin () {
    try {
      this.loginSpinner.style.visibility = 'visible';
      if( await this.usernameManager.checkUsername(true) )
      {
        this.loginStatus.innerText = 'Fetching Credentials';
        const hashedUsername = await this.usernameManager.hashedUsername();
        const credentials = await this.readonlyContract.credentialIdsByUsername(hashedUsername);
        const binaryCreds = credentials.map((_) => toBeArray(_));
        const authed = await credentialGet(binaryCreds);

        // Ask contract to verify our WebAuthN attestation
        const resp = await this.readonlyContract.verifyECES256P256(
          authed.credentialIdHashed,
          authed.challenge,
          authed.resp);

        // Display login status, why is Uint8Array comparison fkd in JS?
        const success = 0 == indexedDB.cmp(toBeArray(resp.username), hashedUsername);
        this.loginStatus.innerText = success ? `Success (${resp.account})` : 'Failure!';
      }
    }
    finally {
      this.loginSpinner.style.visibility = 'hidden';
    }
  }

  async _onTest () {
    setVisibility(this.testSpinner, true);
    try {
      if( await this.usernameManager.checkUsername(true) ) {
        this.testStatus.innerText = 'Fetching Credentials';

        const provider = this.readonlyContract.runner!.provider!;
        const feeData = await provider.getFeeData();
        const network = await provider.getNetwork();
        const chainId = network.chainId;

        // Create random input and encode `.sign` call
        const ai = Account__factory.createInterface();
        const randStuff = crypto.getRandomValues(new Uint8Array(32));
        const calldata = ai.encodeFunctionData("sign", [randStuff]);
        ai.encodeFunctionData('signEIP155', [{
          nonce: 13,
          chainId: network.chainId,
          gasLimit: 1000000,
          gasPrice: feeData.gasPrice,
          // TODO: data
          // TODO: to
          value: 0
        } as EIP155Signer.EthTxStruct]);

        // Construct personalized challenge hash of calldata etc.
        const accountIdHex = (await this.readonlyContract.getAddress()).slice(2);
        const saltHex = toBeHex(toBigInt(await this.usernameManager.salt()),32);
        const personalization = sha256('0x' + toBeHex(chainId!, 32).slice(2) + accountIdHex + saltHex.slice(2));
        const personalizedHash = sha256(personalization + sha256(calldata).slice(2));

        // Perform WebAuthN signing of challenge
        const challenge = toBeArray(personalizedHash);
        const hashedUsername = await this.usernameManager.hashedUsername();
        const credentials = await this.readonlyContract.credentialIdsByUsername(hashedUsername);
        const binaryCreds = credentials.map((_) => toBeArray(_));
        const authed = await credentialGet(binaryCreds, challenge);

        // Perform proxied view call with WebAuthN
        const resp = await this.readonlyContract.proxyViewECES256P256(authed.credentialIdHashed, authed.resp, calldata);
        const respDecoded = ai.decodeFunctionResult('sign', resp);
        console.log(respDecoded);
        this.testStatus.innerText = `${respDecoded}`;
      }
    }
    catch( e:any ) {
      this.testStatus.innerText = `${e}`;
    }
    finally {
      setVisibility(this.testSpinner, false);
    }
  }
}

// ------------------------------------------------------------------

class App {
  providers: EthProviders;
  walletManager: WalletManager;
  webauthnManager: WebAuthNManager;

  constructor (_config: AppConfig) {
    this.providers = new EthProviders();
    this.walletManager = new WalletManager(this.providers, _config);
    this.webauthnManager = new WebAuthNManager(this.providers, _config);
    console.log('App Started', _config);
  }

  async attach () {
    await this.providers.attach();
    await this.walletManager.attach();
    await this.webauthnManager.attach();
  }
}

// ------------------------------------------------------------------

declare global {
  var APP: App;
}

window.onload = async () => {
  const config = {
    sapphireJsonRpc: process.env.VITE_SAPPHIRE_JSONRPC!,
    webauthContract: process.env.VITE_WEBAUTH_ADDR!,
    sapphireChainId: parseInt(process.env.VITE_SAPPHIRE_CHAIN_ID!,16)
  } as AppConfig;
  if( ! config.webauthContract ) {
    throw Error('No WebAuthNExample contract address specified! (VITE_WEBAUTH_ADDR)');
  }
  if( ! config.sapphireJsonRpc ) {
    throw new Error('No Sapphire JSON RPC endpoint provided! (VITE_SAPPHIRE_JSONRPC)')
  }

  globalThis.APP = new App(config);

  await globalThis.APP.attach();
}
