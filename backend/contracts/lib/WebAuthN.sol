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
    uint16 credentialIdLength;
    bytes credentialId;
    bytes credentialPublicKey;
}

struct AuthenticatorData {
    bytes32 rpIdHash;
    bool flag_UP;   // bit 0, User Presence
    bool flag_UV;   // bit 2, User Verification
    bool flag_BE;   // bit 3, Backup Eligibility
    bool flag_BS;   // bit 4, Backup State
    bool flag_AT;   // bit 6, Attested Credential Data
    bool flag_ED;   // bi6 7, Extension Data
    uint32 signCount;
    AttestedCredentialData acd;
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
    ad.flag_UP = (flags & (1<<0)) != 0;
    ad.flag_UV = (flags & (1<<2)) != 0;
    ad.flag_BE = (flags & (1<<3)) != 0;
    ad.flag_BS = (flags & (1<<4)) != 0;
    ad.flag_AT = (flags & (1<<6)) != 0;
    ad.flag_ED = (flags & (1<<7)) != 0;

    ad.signCount = uint32(bytes4(data[33:37]));

    if( ad.flag_AT )
    {
        ad.acd.aaguid = bytes16(data[37:69]);
        ad.acd.credentialIdLength = uint16(bytes2(data[69:71]));
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

    function verifyPubkey (CosePublicKey calldata in_pubkey)
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
