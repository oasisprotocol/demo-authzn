import {CBOR} from "cbor-redux";
import * as asn1js from "asn1js";
import { keccak256, toBigInt } from "ethers";

function toU32(buf:Uint8Array) {
    return (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
}

function toU16(buf:Uint8Array) {
    return (buf[0] << 8) | buf[1];
}

/** @typedef {}
 */
interface RawCOSEPublicKey {
    '1': number,
    '3': number,
    '-1': number,
    '-2': Uint8Array,
    '-3': Uint8Array|undefined
}

interface COSEPublicKey_EC {
    kty: number,
    alg: number,
    crv: number,
    x: bigint,
    y: bigint
}

type COSEPublicKey = COSEPublicKey_EC;

/**
 * Decode a COSE public key into dict (Containing: kty, alg, crv, etc.)
 */
function COSEPublicKey_decode (buf:ArrayBufferLike) : COSEPublicKey
{
    const cpk = CBOR.decode<RawCOSEPublicKey>(buf);

    const kty = cpk[1];

    // Elliptic Curve key type
    if( kty == 2 ) {
        const ret = {
            kty,
            alg: cpk[3],
            crv: cpk[-1],
            x: toBigInt(cpk[-2]),
            /** @type {Uint8Array} */
            y: toBigInt(cpk[-3]!)
        } as COSEPublicKey_EC;

        // Restrict to specific supported algorithms
        if( ! (ret.alg == -7 && ret.crv == 1)       // ES256 + P-256 (NIST)
         && ! (ret.alg == -8 && ret.crv == 6 )) {   // EdDSA + Ed25519
            throw new Error(`Unknown alg: ${ret.alg}, crv: ${ret.crv}`);
        }

        return ret;
    }

    throw new Error(`Unsupported kty: ${kty}`)
}

interface AttestedCredentialData {
    aaguid: Uint8Array;
    credentialId: Uint8Array;
    credentialPublicKey: COSEPublicKey;
}

interface AuthenticatorData {
    rpIdHash: Uint8Array;
    flags: {
        UP: boolean;
        UV: boolean;
        BE: boolean;
        BS: boolean;
        AT: boolean;
        ED: boolean;
    };
    signCount: number;
    attestedCredentialData?: AttestedCredentialData;
}

interface AttestationObject {
    authData:Uint8Array,
    attStmt:any[],
    fmt:"packed"|"tpm"|"android-key"|"nadroid-safetynet"|"fido-u2f"|"apple"|"none"
}

export function decodeAuthenticatorData (ad: Uint8Array) {
    if( (ad.byteLength - ad.byteOffset) < 37 ) {
        throw new Error('Attestation Object must be at least 37 bytes or longer');
    }

    // https://www.w3.org/TR/webauthn-2/#sctn-authenticator-data
    const flags = ad.slice(32, 33)[0];

    const authDataDict:AuthenticatorData = {
        rpIdHash: ad.slice(0, 32),          // 32 bytes, SHA256(rp.id), e.g. SHA256(b'localhost')
        flags: {                            //  1 byte
            UP: (flags & (1<<0)) != 0,      // Bit 0: User Present (UP) result
                                            // Bit 1: Reserved for future use (RFU1)
            UV: (flags & (1<<2)) != 0,      // Bit 2: User Verified (UV) result
            BE: (flags & (1<<3)) != 0,      // Bit 3: Backup Eligibility (BE)
            BS: (flags & (1<<4)) != 0,      // Bit 3: Backup State (BS)
                                            // Bit 5: Reserved for future use (RFU2)
            AT: (flags & (1<<6)) != 0,      // Bit 6: Attested credential data included (AT)
            ED: (flags & (1<<7)) != 0       // Bit 7: Extension data included (ED).
        },
        signCount: toU32(ad.slice(33, 37))  //  4 bytes
    }

    if( authDataDict.flags.ED ) {
        throw new Error('Extension Data not supported!');
    }

    // https://www.w3.org/TR/webauthn-2/#sctn-attested-credential-data
    if( authDataDict.flags.AT )
    {
        const credentialIdLength = toU16(ad.slice(53, 55));         // 2 bytes
        authDataDict.attestedCredentialData = {
            aaguid: ad.slice(37, 53),                  // 16 bytes
            credentialId: ad.slice(55, 55+credentialIdLength),
            // vanillacbor.decodeOnlyFirst(buffer).byteLength;
            // https://www.w3.org/TR/webauthn-2/#sctn-encoded-credPubKey-examples
            credentialPublicKey: COSEPublicKey_decode(ad.slice(55+credentialIdLength).buffer)
        }
    }

    return authDataDict;
}

/**
 * Decodes an attestation object into its components
 */
function decodeAttestationObject (aob:ArrayBufferLike)
{
    // https://www.w3.org/TR/webauthn-2/#attestation-object
    const attestationObject = CBOR.decode<AttestationObject>(new Uint8Array(aob).buffer);

    // For details of `attStmt` see:
    // - https://www.w3.org/TR/webauthn/#sctn-defined-attestation-formats
    // - https://www.iana.org/assignments/webauthn/webauthn.xhtml#webauthn-attestation-statement-format-ids

    const ad = attestationObject.authData;

    console.log(ad.toString());

    return decodeAuthenticatorData(ad);
}

function arrayBufferToBase64(buffer:Uint8Array) {
    var binary = '';
    var bytes = [].slice.call(buffer);
    bytes.forEach((b) => binary += String.fromCharCode(b));
    return window.btoa(binary);
};

export async function credentialCreate (rp: PublicKeyCredentialRpEntity, user:PublicKeyCredentialUserEntity, challenge:Uint8Array)
{
    let pkc = await navigator.credentials.create({
        publicKey: {
            attestation: "none",
            challenge: challenge.buffer,
            pubKeyCredParams: [
                //{alg: -8, type: "public-key"},   // Ed25519
                {alg: -7, type: "public-key"},   // ES256
                //{alg: -257, type: "public-key"}  // RS256
            ],
            rp,
            user
        }
    }) as PublicKeyCredential|null;

    if( ! pkc ) {
        throw new Error('No PublicKeyCredential returned!');
    }

    const challengeB64 = arrayBufferToBase64(challenge);
    const resp = pkc.response as AuthenticatorAttestationResponse;
    const cdj = new TextDecoder('utf-8').decode(resp.clientDataJSON);
    console.log(pkc, cdj, challengeB64);
    return {
        id: new Uint8Array(pkc.rawId),
        cd: cdj,
        ad: decodeAttestationObject(resp.attestationObject)
    };
}


/**
 * Object to typed token array
 */
function object2makejson (o:{ [id: string]: string | boolean })
{
    return Object.entries(o).map(([k, v]) => {
        if( typeof v == "boolean" ) {
            return {
                t: 1,
                k: k,
                v: v ? "true" : "false"
            };
        }
        if( typeof v == "string" ) {
            return {
                t: 0,
                k: k,
                v: v
            };
        }
        throw new Error(`Incompatible value type! Key:${k} Value:${v}`);
    });
}

var asn1_sig_schema = new asn1js.Sequence({
    name: "sig",
    value: [
      new asn1js.Integer({
        name: "r"
      }),
      new asn1js.Integer({
        name: "s"
      })
    ]
  });


export async function credentialGet(credentials:Uint8Array[], challenge?: Uint8Array)
{
    if( ! challenge ) {
        challenge = crypto.getRandomValues(new Uint8Array(32));
    }

    const authed = await navigator.credentials.get({
        publicKey: {
            allowCredentials: credentials.map((_) => { return {id: _, type: 'public-key'} as PublicKeyCredentialDescriptor; }),
            challenge,
        }
    }) as PublicKeyCredential;

    const resp = authed.response as AuthenticatorAssertionResponse;

    const decodedSignature = asn1js.verifySchema(resp.signature, asn1_sig_schema);
    if( ! decodedSignature.verified ) {
        throw new Error("Unable to decode ASN.1 signature!");
    }

    const result: {r:asn1js.Integer, s:asn1js.Integer} = decodedSignature.result as any;
    const r = result.r.toBigInt();
    const s = result.s.toBigInt();

    const clientData = JSON.parse(new TextDecoder().decode(resp.clientDataJSON));
    console.log(clientData);
    return {
        credentialIdHashed: keccak256(new Uint8Array(authed.rawId)),
        challenge: challenge,
        resp: {
            authenticatorData: new Uint8Array(resp.authenticatorData),
            clientDataTokens: object2makejson(clientData),
            sigR: r,
            sigS: s
        }
    };
}
