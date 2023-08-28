// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {MakeJSON} from "./MakeJSON.sol";
import {Base64URL} from "./Base64URL.sol";
import {SECP256R1Precompile} from "./SECP256R1Precompile.sol";

struct CosePublicKey {
    uint8 kty;
    int8 alg;
    uint8 crv;
    uint256 x;
    uint256 y;
}

struct AttestedCredentialData {
    bytes16 aaguid;
    bytes credentialId;
    bytes credentialPublicKey;
}

struct AuthenticatorDataFlags {
    bool UP;
    bool UV;
    bool BE;
    bool BS;
    bool AT;
    bool ED;
}

struct AuthenticatorData {
    bytes32 rpIdHash;
    AuthenticatorDataFlags flags;
    uint32 signCount;
    AttestedCredentialData attestedCredentialData;
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/Authenticator_data
 *
 *          ,----------.-------.-----------.------------------------------------------------------------------.
 *  slice:  |   0:32   |   32  |   33:37   | 37:(55+n+x)                                                      |
 * length:  |    32    |   1   |     4     | 16 + 2 + n + x                                                   |
 *   name:  | rpIdHash | flags | signCount | attestedCredentialData                                           |
 *          `----------'-------'-----------+--------.--------------------.--------------.---------------------|
 *                                 slice:  |  37:53 |      53:55 (n)     |    55:55+n   |     55+n:55+n+x     |
 *                                length:  |   16   |         2          |      n       |          x          |
 *                                  name:  | aaguid | credentialIdLength | credentialId | credentialPublicKey |
 *                                         `--------'--------------------'--------------'---------------------'
 *
 * @param data Authenticator data structure
 */
function parseAuthenticatorData (bytes calldata data)
    pure
    returns (AuthenticatorData memory ad)
{
    require( data.length >= 37 );

    ad.rpIdHash = bytes32(data[:32]);

    uint8 flags = uint8(data[32]);
    ad.flags.UP = (flags & (1<<0)) != 0;
    ad.flags.UV = (flags & (1<<2)) != 0;
    ad.flags.BE = (flags & (1<<3)) != 0;
    ad.flags.BS = (flags & (1<<4)) != 0;
    ad.flags.AT = (flags & (1<<6)) != 0;
    ad.flags.ED = (flags & (1<<7)) != 0;

    ad.signCount = uint32(bytes4(data[33:37]));

    if( ad.flags.AT )
    {
        AttestedCredentialData memory at = ad.attestedCredentialData;

        at.aaguid = bytes16(data[37:53]);

        uint credentialIdLength = uint16(bytes2(data[53:55]));
        at.credentialId = data[55:55+credentialIdLength];

        at.credentialPublicKey = data[55+credentialIdLength:];

        // TODO: parse `credentialPublicKey` in COSE format with CBOR encoding

        // We are unable to parse both AT & ED content
        // As credentialPublicKey is expected to consist of the rest of the buffer
        require( ad.flags.ED == false );
    }
}

struct AuthenticatorResponse {
    bytes authenticatorData;
    MakeJSON.KeyValue[] clientDataTokens;
    uint256 sigR;
    uint256 sigS;
}

library WebAuthN {
    bytes32 constant private CHALLENGE_KEY_HASH = keccak256("challenge");
    bytes32 constant private TYPE_KEY_HASH = keccak256("type");
    bytes32 constant private WEBAUTHN_GET_HASH = keccak256("webauthn.get");

    function verifyPubkey (CosePublicKey memory in_pubkey)
        internal pure
        returns (bool)
    {
        // Validate form of public key provided upon registration
        require( in_pubkey.kty == 2, "registerECES256P256: invalid kty" );  // Elliptic Curve format
        require( in_pubkey.alg == -7, "registerECES256P256: invalid alg" ); // ES256 algorithm
        require( in_pubkey.crv == 1, "registerECES256P256: invalid crv" );  // P-256 curve
        require( SECP256R1Precompile.isOnCurve(in_pubkey.x, in_pubkey.y), "registerECES256P256: invalid point" );   // Must be valid curve point

        return true;
    }

    function verifyECES256P256 (
        bytes32 in_challenge,
        uint256[2] memory in_pubkey,
        AuthenticatorResponse memory in_resp
    )
        internal view
        returns (bool)
    {
        if( ! WebAuthN.verifyClientDataTokens(in_challenge, in_resp.clientDataTokens) ) {
            return false;
        }

        string memory clientDataJSON = MakeJSON.from(in_resp.clientDataTokens);

        bytes32 digest = sha256(abi.encodePacked(in_resp.authenticatorData, sha256(abi.encodePacked(clientDataJSON))));

        if( ! SECP256R1Precompile.ecdsa_verify_raw(in_pubkey, uint256(digest), in_resp.sigR, in_resp.sigS) ) {
            return false;
        }

        return true;
    }

    /**
     * Verify the clientDataJSON structure
     * @custom:see https://developer.mozilla.org/en-US/docs/Web/API/AuthenticatorResponse/clientDataJSON
     * @param in_challenge Authenticator challenge (32 bytes)
     * @param in_clientDataTokens JSON data split into key/value tokens (see: MakeJSON.sol)
     */
    function verifyClientDataTokens (
        bytes32 in_challenge,
        MakeJSON.KeyValue[] memory in_clientDataTokens
    )
        internal pure
        returns (bool)
    {
        // Verify the raw challenge matches what's in the JSON
        string memory challengeBase64 = Base64URL.encode(abi.encodePacked(in_challenge), false);
        bytes32 challengeBase64Hashed = keccak256(bytes(challengeBase64));

        bool isTypeOk = false;      // type == webauthn.get
        bool isChallengeOk = false;

        for( uint i = 0; i < in_clientDataTokens.length; i++ )
        {
            MakeJSON.KeyValue memory item = in_clientDataTokens[i];
            bytes32 keyHash = keccak256(bytes(item.k));
            bytes32 valueHash = keccak256(bytes(item.v));

            if( keyHash == CHALLENGE_KEY_HASH )
            {
                isChallengeOk = challengeBase64Hashed == valueHash;
            }
            else if( keyHash == TYPE_KEY_HASH ) {
                isTypeOk = valueHash == WEBAUTHN_GET_HASH;
            }

            // Other keys are ignored
        }

        return isChallengeOk && isTypeOk;
    }
}
