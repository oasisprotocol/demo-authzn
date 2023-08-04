import * as sapphire from "@oasisprotocol/sapphire-paratime";
import { ethers } from "ethers";
import detectEthereumProvider from '@metamask/detect-provider';
import { Exome } from "exome"

// ------------------------------------------------------------------

interface RequestArguments {
    readonly method: string;
    readonly params?: readonly unknown[] | object;
}

interface ProviderRpcError extends Error {
    code: number;
    data?: unknown;
}

interface ProviderMessage {
    readonly type: string;
    readonly data: unknown;
}

interface ProviderConnectInfo {
    readonly chainId: string;
}

interface MetaMaskEthereumProvider {
    isMetaMask?: boolean;
    once(eventName: string | symbol, listener: (...args: any[]) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
    off(eventName: string | symbol, listener: (...args: any[]) => void): this;
    addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;

    isConnected(): boolean;
    request(args: RequestArguments): Promise<unknown>;
    _metamask: {
        isUnlocked(): Promise<boolean>;
    }
}

// ------------------------------------------------------------------

export interface EthWallet {
    chainId: number;
    address?: string;
}

// ------------------------------------------------------------------

export class EthProviders extends Exome
{
    // Unwrapped Provider
    public up?: ethers.providers.JsonRpcProvider;

    // Sapphire Wrapped Provider
    public swp?: ethers.providers.JsonRpcProvider & sapphire.SapphireAnnex;

    // Sapphire Wrapped Signer
    public sws?: ethers.providers.JsonRpcSigner & sapphire.SapphireAnnex;

    // window.ethereum
    public eth?: MetaMaskEthereumProvider;

    public wallet?: EthWallet;

    public connected: boolean;

    public accounts: string[];

    constructor (public config: AppConfig)
    {
        super();

        this.connected = false;

        this.accounts = [];
    }

    private log (name: string, ...args:any[]) {
        console.log(`EthProviders.${name}`, ...args);
    }

    async _onConnect (connectInfo: ProviderConnectInfo) {
        this.log('onConnect', connectInfo);
        this.connected = true;
        await this._walletRefresh();
    }

    async _onMessage (message: ProviderMessage) {
        this.log('onMessage', message);
        await this._walletRefresh();
    }

    async _onDisconnect (error: ProviderRpcError) {
        this.log('onDisconnect', error);
        this.connected = false;
        await this._walletRefresh();
    }

    async _onAccountsChanged (accounts: Array<string>) {
        this.log('onAccountsChanged', accounts);
        this.accounts = accounts;
        this.connected = accounts.length > 0;
        await this._walletRefresh();
    }

    async _onChainChanged (chainId: string) {
        this.log('onChainChanged', chainId);
        await this._walletRefresh();
    }

    async _walletRefresh ()
    {
        if( this.eth )
        {
            let address: string | undefined;

            this.accounts = await this.eth.request({method: 'eth_accounts'}) as string[];
            if( this.accounts.length ) {
                address = this.accounts[0];
            }

            this.connected = this.accounts.length > 0;

            const chainId = await this.eth.request({method: 'eth_chainId'}) as string;

            this.wallet = {
                chainId: parseInt(chainId,16),
                address
            };

            this.up = new ethers.providers.Web3Provider(this.eth);

            this.swp = sapphire.wrap(this.up);

            this.sws = sapphire.wrap(this.up.getSigner(address));
        }
    }

    async attach ()
    {
        if( ! this.eth )
        {
            const eth = await detectEthereumProvider()
            if( ! eth ) {
                return false;
            }

            this.eth = eth as MetaMaskEthereumProvider;

            eth.on('connect', this._onConnect.bind(this));
            eth.on('messaget', this._onMessage.bind(this));
            eth.on('disconnect', this._onDisconnect.bind(this));
            eth.on('accountsChanged', this._onAccountsChanged.bind(this));
            eth.on('chainChanged', this._onChainChanged.bind(this));

            await this._walletRefresh();
        }
        return true;
    }

    async connect ()
    {
        if( this.connected ) {
            return true;
        }

        if( this.eth ) {
            this.accounts = await this.eth.request({method: 'eth_requestAccounts'}) as string[];
        }
    }
}
