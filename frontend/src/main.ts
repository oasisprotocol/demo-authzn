import { EthProviders } from './ctx'
import { subscribe } from "exome";
import {ethers} from "ethers";
import { WebAuthNExample__factory } from "demo-authzn-backend";
import { pbkdf2Sync } from "pbkdf2"
import { credentialCreate, credentialGet } from './webauthn';

// ------------------------------------------------------------------

/**
 * Displays wallet connectivity status and allows you to connect etc.
 */
class WalletManager
{
  status = document.querySelector<HTMLSpanElement>('#wallet-status')!;
  network = document.querySelector<HTMLSpanElement>('#wallet-network')!;
  account = document.querySelector<HTMLSpanElement>('#wallet-account')!;
  button = document.querySelector<HTMLButtonElement>('#wallet-button')!;

  constructor (public providers:EthProviders) {
    subscribe(providers, this.refresh.bind(this));
  }

  attach () {
    this.button.addEventListener('click', this._onButton.bind(this));
    this.refresh();
  }

  async _onButton () {
    const providers = this.providers;
    if( ! providers.connected ) {
      await providers.connect();
    }
  }

  refresh () {
    const wallet = this.providers.wallet;
    const connected = this.providers.connected;
    setDisabled(this.button, connected);
    this.button.style.visibility = connected ? 'hidden' : 'visible';
    this.status.innerText = 'Wallet ' + (connected ? 'Connected' : 'Disconnected');
    if( wallet ) {
      this.network.innerText = `Network: ${wallet.chainId}`;
      this.account.innerText = wallet.address ?? "";
    }
  }
}

// ------------------------------------------------------------------

function setDisabled(element:HTMLElement, disabled:boolean)
{
  if( disabled ) {
    element.setAttribute('disabled', 'disabled');
  }
  else {
    element.removeAttribute('disabled');
  }
}

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
    return this.usernameInput.value.toLowerCase();
  }

  async hashedUsername (username?: string) : Promise<Uint8Array> {
    if( ! username ) {
      username = this.username;
    }
    if( username in this._usernameHashesCache ) { // Cache pbkdf2 hashed usernames locally
      return this._usernameHashesCache[username];
    }
    if( this._salt === null ) { // Retirve contract salt only once
      this._salt = ethers.utils.arrayify(await this.readonlyContract.salt());
    }
    const start = new Date();
    const result = pbkdf2Sync(this.username, this._salt, 100_000, 32, 'sha256');
    const end = new Date();
    console.log('pbkdf2', username, '=', end.getTime() - start.getTime(), 'ms');
    this._usernameHashesCache[username] = result;
    return result;
  }

  async _userExists(username:string) {
    const h = await this.hashedUsername(username);
    return await this.readonlyContract.userExists(h);
  }

  async _onCheck () {
    if( await this.checkUsername(false) ) {
      this.usernameStatus.innerText = 'Available';
    }
  }

  async checkUsername (mustExist:boolean) {
    this.usernameStatus.innerText = '...';
    this.usernameSpinner.style.visibility = "visible";
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
      if( await this._userExists(this.username) ) {
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
      this.usernameSpinner.style.visibility = "hidden";
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

/*
function uint8array_to_base64( bytes: Uint8Array ) {
  var binary = '';
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
      binary += String.fromCharCode( bytes[ i ] );
  }
  return btoa( binary );
}
*/

class WebAuthNManager
{
  registerButton = document.querySelector<HTMLButtonElement>('#webauthn-register-button')!;
  registerStatus = document.querySelector<HTMLSpanElement>('#webauthn-register-status')!;
  registerSpinner = document.querySelector<HTMLImageElement>('#webauthn-register-spinner')!;
  loginButton = document.querySelector<HTMLButtonElement>('#webauthn-login-button')!;
  loginStatus = document.querySelector<HTMLSpanElement>('#webauthn-login-status')!;
  loginSpinner = document.querySelector<HTMLImageElement>('#webauthn-login-spinner')!;

  usernameManager: UsernameManager;

  get readonlyContract () {
    if( ! this._providers.up ) {
      throw Error('Not connected!');
    }
    return WebAuthNExample__factory.connect(this._config.webauthContract, this._providers.up);
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
  }

  async attach () {
    this.registerButton.addEventListener('click', this._onRegister.bind(this));
    this.loginButton.addEventListener('click', this._onLogin.bind(this));
    await this.usernameManager.attach();
  }

  async _onRegister () {
    this.registerSpinner.style.visibility = 'visible';
    try {
      if( await this.usernameManager.checkUsername(false) )
      {
        this.registerStatus.innerText = 'Requesting WebAuthN Creation';
        const hashedUsername = await this.usernameManager.hashedUsername();
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const cred = await credentialCreate({
          name: "blah",
          id: "localhost"
        }, {
          id: hashedUsername,
          name: this.usernameManager.username,
          displayName: this.usernameManager.username
        }, challenge);

        const tx = await this.signingContract.registerECES256P256(hashedUsername, cred.id, cred.ad.at!.credentialPublicKey!)
        this.registerStatus.innerText = `Registering (tx: ${tx.hash})`;
        const receipt = await tx.wait();
        this.registerStatus.innerText = `Registered (block: ${receipt.blockNumber}, tx: ${tx.hash})`;
      }
    }
    finally {
      this.registerSpinner.style.visibility = 'hidden';
    }
  }

  async _onLogin () {
    try {
      const hashedUsername = await this.usernameManager.hashedUsername();
      this.loginSpinner.style.visibility = 'visible';
      if( await this.usernameManager.checkUsername(true) )
      {
        this.loginStatus.innerText = 'Fetching Credentials';
        const credentials = await this.readonlyContract.credentialIdsByUsername(hashedUsername);

        const binaryCreds = credentials.map((_) => ethers.utils.arrayify(_));
        //const b64Creds = binaryCreds.map((_) => uint8array_to_base64(_).replace(/=+$/, ""));

        const authed = await credentialGet(binaryCreds);

        const contract = this.readonlyContract;
        const resp = await contract.verify(
          authed.in_credentialIdHashed,
          authed.in_authenticatorData,
          authed.in_clientDataJSON,
          authed.in_sigR,
          authed.in_sigS);

        if( 0 == indexedDB.cmp(ethers.utils.arrayify(resp), hashedUsername) ) {
          this.loginStatus.innerText = 'Success';
        }
        else {
          this.loginStatus.innerText = 'Failure!';
        }
      }
    }
    finally {
      this.loginSpinner.style.visibility = 'hidden';
    }
  }
}

// ------------------------------------------------------------------

class App {
  providers: EthProviders;
  walletManager: WalletManager;
  webauthnManager: WebAuthNManager;

  constructor (public config: AppConfig) {
    this.providers = new EthProviders(config);
    this.walletManager = new WalletManager(this.providers);
    this.webauthnManager = new WebAuthNManager(this.providers, config);
    console.log('App Started', config);
  }

  async attach () {
    await this.providers.attach();
    this.walletManager.attach();
    await this.webauthnManager.attach();
  }
}

// ------------------------------------------------------------------

declare global {
  var app: App;
}

window.onload = async () => {
  const config = {
    sapphireJsonRpc: import.meta.env.VITE_SAPPHIRE_JSONRPC!,
    webauthContract: import.meta.env.VITE_WEBAUTH_ADDR!
  } as AppConfig;
  if( ! config.webauthContract ) {
    throw Error('No WebAuthNExample contract address specified! (VITE_WEBAUTH_ADDR)');
  }
  if( ! config.sapphireJsonRpc ) {
    throw new Error('No Sapphire JSON RPC endpoint provided! (VITE_SAPPHIRE_JSONRPC)')
  }

  globalThis.app = new App(config);

  await globalThis.app.attach();
}
