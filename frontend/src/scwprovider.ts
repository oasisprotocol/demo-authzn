import {
    AbstractSigner,
    BytesLike,
    Provider,
    Signature,
    Transaction,
    TransactionLike,
    TransactionRequest,
    TypedDataDomain,
    TypedDataEncoder,
    TypedDataField,
    assert,
    assertArgument,
    dataLength,
    getAddress,
    hashMessage,
    resolveAddress,
    resolveProperties,
    sha256,
    toBeArray,
    toBeHex
} from "ethers";
import { pbkdf2Sync } from "pbkdf2"
import sapphire from "@oasisprotocol/sapphire-paratime"
import { credentialGet } from './webauthn.ts';
import {
    WebAuthNExample,
    WebAuthNExample__factory,
    Account,
    Account__factory
 } from "demo-authzn-backend";

interface WebAuthConfig {
    wrappedProvider: Provider & sapphire.SapphireAnnex;
    webauth: WebAuthNExample;
    webauthAddress: string;
    chainId: bigint;
    salt: string;
    username: string;
    usernameHashed: Uint8Array;
    scwAccount: Account;
    scwGasPayer: string;
}

export class WebAuthSigner extends AbstractSigner
{
    readonly address!: string;

    readonly #config: WebAuthConfig;

    constructor(config:WebAuthConfig, provider: Provider & sapphire.SapphireAnnex) {
        super(provider);

        this.#config = config;
    }

    static async create (username: string, webauthAddress: string, provider: Provider)
    {
        const wrappedProvider = sapphire.wrap(provider);
        const webauth = WebAuthNExample__factory.connect(webauthAddress, provider);
        const chainId = (await provider.getNetwork()).chainId;
        const salt = await webauth.salt();
        const usernameHashed = pbkdf2Sync(username, salt, 100_000, 32, 'sha256');
        const scwUser = await webauth.getUser(usernameHashed);
        const scwAccount = Account__factory.connect(scwUser.account, wrappedProvider);
        const scwGasPayer = await scwAccount.keypairAddress();
        const config = {
            wrappedProvider,
            webauth,
            webauthAddress,
            chainId,
            salt,
            username,
            usernameHashed,
            scwAccount,
            scwGasPayer
        } as WebAuthConfig;
        return new WebAuthSigner(config, wrappedProvider);
    }

    async getAddress(): Promise<string> {
        return this.#config.scwGasPayer;
    }

    connect(_provider: null | Provider): WebAuthSigner {
        assert(false, "Cannot re-connect existing WebAuthSigner", "UNSUPPORTED_OPERATION", {operation: "connect"});
    }

    async #sign(digest: BytesLike): Promise<Signature> {
        assertArgument(dataLength(digest) === 32, "invalid digest length", "digest", digest);

        const config = this.#config;
        const ai = config.scwAccount.interface;
        const calldata = ai.encodeFunctionData("sign", [digest]);

        // Construct personalized challenge hash of calldata etc.
        const accountIdHex = config.webauthAddress.slice(2);
        const saltHex = toBeHex(config.salt, 32);
        const personalization = sha256('0x' + toBeHex(config.chainId, 32).slice(2) + accountIdHex + saltHex.slice(2));
        const challenge = toBeArray(sha256(personalization + sha256(calldata).slice(2)));

        // Ask WebAuthN to sign challenge
        const credentials = await config.webauth.credentialIdsByUsername(config.usernameHashed);
        const binaryCreds = credentials.map((_) => toBeArray(_));
        const authed = await credentialGet(binaryCreds, challenge);

        // Proxied view-call to sign(digest), then decode result into ethers signature
        const resp = await config.webauth.proxyViewECES256P256(authed.credentialIdHashed, authed.resp, calldata);
        const respDecoded = ai.decodeFunctionResult('sign', resp);
        return Signature.from({
            r: respDecoded.r,
            s: respDecoded.s,
            v: respDecoded.v
        });
    }

    async signTransaction(tx: TransactionRequest): Promise<string> {

        // Replace any Addressable or ENS name with an address
        const { to, from } = await resolveProperties({
            to: (tx.to ? resolveAddress(tx.to, this.provider): undefined),
            from: (tx.from ? resolveAddress(tx.from, this.provider): undefined)
        });

        if (to != null) { tx.to = to; }
        if (from != null) { tx.from = from; }

        if (tx.from != null) {
            assertArgument(getAddress(<string>(tx.from)) === this.address,
                "transaction from address mismatch", "tx.from", tx.from);
            delete tx.from;
        }

        // Build the transaction
        const btx = Transaction.from(<TransactionLike<string>>tx);
        btx.signature = await this.#sign(btx.unsignedHash);

        return btx.serialized;
    }

    async signMessage(message: string | Uint8Array): Promise<string> {
        return this.signMessageSync(message);
    }

    // @TODO: Add a secialized signTx and signTyped sync that enforces
    // all parameters are known?
    /**
     *  Returns the signature for %%message%% signed with this wallet.
     */
    async signMessageSync(message: string | Uint8Array): Promise<string> {
        const signature = await this.#sign(hashMessage(message));
        return signature.serialized;
    }

    async signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>): Promise<string>
    {
        // Populate any ENS names
        const populated = await TypedDataEncoder.resolveNames(domain, types, value, async (name: string) => {
            // @TODO: this should use resolveName; addresses don't
            //        need a provider

            assert(this.provider != null, "cannot resolve ENS names without a provider", "UNSUPPORTED_OPERATION", {
                operation: "resolveName",
                info: { name }
            });

            const address = await this.provider.resolveName(name);
            assert(address != null, "unconfigured ENS name", "UNCONFIGURED_NAME", {
                value: name
            });

            return address;
        });

        const signature = await this.#sign(TypedDataEncoder.hash(populated.domain, types, populated.value));
        return signature.serialized;
    }
}
