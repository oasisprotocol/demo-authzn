import * as sapphire from "@oasisprotocol/sapphire-paratime";
import { ethers } from "ethers";
import detectEthereumProvider from '@metamask/detect-provider';
import { Exome } from "exome"
import { NETWORKS, NetworkDefinition } from "./networks";

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
    isConnected(): boolean;
    once(eventName: string | symbol, listener: (...args: any[]) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
    off(eventName: string | symbol, listener: (...args: any[]) => void): this;
    addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;
    request(args: RequestArguments): Promise<unknown>;

    isMetaMask?: boolean;
    _metamask: {
        isUnlocked(): Promise<boolean>;
    }
}

// ------------------------------------------------------------------

export interface EthWallet {
    chainId: number;
    network?: NetworkDefinition;
    address?: string;
}

// ------------------------------------------------------------------

export class EthProviders extends Exome
{
    // Sapphire Wrapped Provider
    public swp?: ethers.providers.JsonRpcProvider & sapphire.SapphireAnnex;

    // Sapphire Wrapped Signer
    public sws?: ethers.providers.JsonRpcSigner & sapphire.SapphireAnnex;

    // window.ethereum
    public eth?: MetaMaskEthereumProvider;

    public wallet?: EthWallet;

    public connected: boolean;

    public accounts: string[];

    public _account: string|undefined;

    get account () {
        return this._account;
    }

    constructor ()
    {
        super();

        this.connected = false;

        this.accounts = [];
    }

    private _log (name: string, ...args:any[]) {
        console.log(`EthProviders.${name}`, ...args);
    }

    async _onConnect (connectInfo: ProviderConnectInfo) {
        this._log('onConnect', connectInfo);
        this.connected = true;
        await this.refresh();
    }

    async _onMessage (message: ProviderMessage) {
        this._log('onMessage', message);
        await this.refresh();
    }

    async _onDisconnect (error: ProviderRpcError) {
        this._log('onDisconnect', error);
        this.connected = false;
        await this.refresh();
    }

    async _onAccountsChanged (accounts: Array<string>) {
        this._log('onAccountsChanged', accounts);
        this.accounts = accounts;
        this._account = accounts[0];
        this.connected = accounts.length > 0;
        await this.refresh();
    }

    async _onChainChanged (chainId: string) {
        this._log('onChainChanged', chainId);
        await this.refresh();
    }

    async selectAccount(account:string)
    {
        if( ! this.accounts.includes(account) ) {
            return false;
        }

        if( account == this._account ) {
            return false;
        }

        this._account = account;

        console.log('Switched to', account);

        await this.refresh();

        return true;
    }

    async switchNetwork(chainId:number) {
        if( ! this.eth ) {
            return false;
        }

        try {
            await this.eth.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${chainId.toString(16)}` }],
            });
            return true;
        }
        catch (e: any) {
            if ((e as any).code !== 4902) throw e;

            if( ! (chainId in NETWORKS) ) {
                return false;
            }

            const n = NETWORKS[chainId];
            await this.eth.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${chainId.toString(16)}`,
                    chainName: n.chainName,
                    rpcUrls: n.rpcUrls,
                }],
            });

            return true;
        }
    }

    async refresh ()
    {
        if( ! this.eth )
        {
            return false;
        }

        let address: string | undefined;

        this.accounts = await this.eth.request({method: 'eth_accounts'}) as string[];

        if( this.accounts.length )
        {
            if( this._account )
            {
                if( ! this.accounts.includes(this._account) ) {
                    this._account = address = this.accounts[0];
                }
                else {
                    address = this._account;
                }
            }
            else {
                this._account = address = this.accounts[0];
            }
        }
        else {
            this._account = undefined;
        }

        this.connected = this.accounts.length > 0;

        const chainId = await this.eth.request({method: 'eth_chainId'}) as string;

        const nid = parseInt(chainId, 16);
        const n = nid in NETWORKS ? NETWORKS[nid] : undefined;
        this.wallet = {
            chainId: nid,
            network: n,
            address
        };

        const up = new ethers.providers.Web3Provider(this.eth);

        this.swp = sapphire.wrap(up);

        this.sws = sapphire.wrap(up.getSigner(address));

        return true;
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

            await this.refresh();
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
