// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {Point256, SECP256R1} from "./lib/SECP256R1.sol";
import {MakeJSON} from "./lib/MakeJSON.sol";
import {Base64URL} from "./lib/Base64URL.sol";
import {Account,AccountFactory} from "./lib/Account.sol";

struct UserCredential {
    Point256 pubkey;
    bytes credentialId;
    bytes32 username;
}

struct CosePublicKey {
    uint8 kty;
    int8 alg;
    uint8 crv;
    uint256 x;
    uint256 y;
}

struct User {
    bytes32 username;
    Account account;
}

struct AuthenticatorResponse {
    bytes authenticatorData;
    MakeJSON.KeyValue[] clientDataTokens;
    uint256 sigR;
    uint256 sigS;
}

contract WebAuthNExampleStorage {
    mapping(bytes32 => User) internal users;

    mapping(bytes32 => bytes32[]) internal usernameToHashedCredentialIdList;

    mapping(bytes32 => UserCredential) internal credentialsByHashedCredentialId;

    bytes32 internal challengeSecret;

    bytes32 public salt;
}

contract WebAuthNExample is WebAuthNExampleStorage {
    bytes32 constant private CHALLENGE_KEY_HASH = keccak256("challenge");
    bytes32 constant private TYPE_KEY_HASH = keccak256("type");
    bytes32 constant private WEBAUTHN_GET_HASH = keccak256("webauthn.get");

    AccountFactory private accountFactory;

    constructor () {
        challengeSecret = bytes32(Sapphire.randomBytes(32, abi.encodePacked(address(this))));

        salt = bytes32(Sapphire.randomBytes(32, abi.encodePacked(address(this))));

        accountFactory = new AccountFactory();
    }

    function userExists (bytes32 in_username)
        public view
        returns (bool)
    {
        User storage user = users[in_username];

        return user.username != bytes32(0x0);
    }

    function registerECES256P256 (
        bytes32 in_username,
        bytes calldata in_credentialId,
        CosePublicKey calldata in_pubkey
    )
        external
    {
        // Don't allow duplicate registrations
        require( ! userExists(in_username), "registerECES256P256: user exists" );

        // Validate form of public key provided upon registration
        require( in_pubkey.kty == 2, "registerECES256P256: invalid kty" );  // Elliptic Curve format
        require( in_pubkey.alg == -7, "registerECES256P256: invalid alg" ); // ES256 algorithm
        require( in_pubkey.crv == 1, "registerECES256P256: invalid crv" );  // P-256 curve
        require( SECP256R1.isOnCurve(in_pubkey.x, in_pubkey.y), "registerECES256P256: invalid point" );   // Must be valid curve point

        User storage user = users[in_username];
        user.username = in_username;
        user.account = accountFactory.clone(address(this));

        bytes32 hashedCredentialId = keccak256(in_credentialId);
        credentialsByHashedCredentialId[hashedCredentialId] = UserCredential({
            pubkey: Point256(in_pubkey.x, in_pubkey.y),
            credentialId: in_credentialId,
            username: in_username
        });

        usernameToHashedCredentialIdList[in_username].push(hashedCredentialId);
    }

    /**
     * Retrieve a list of credential IDs for a specific user
     * @param in_username Hashed username
     */
    function credentialIdsByUsername(bytes32 in_username)
        public view
        returns (bytes[] memory out_credentialIds)
    {
        require( userExists(in_username), "credentialIdsByUsername" );

        bytes32[] storage credentialIdHashes = usernameToHashedCredentialIdList[in_username];

        uint l = credentialIdHashes.length;

        out_credentialIds = new bytes[](l);

        for( uint i = 0; i < l; i++ )
        {
            UserCredential storage cred = credentialsByHashedCredentialId[credentialIdHashes[i]];

            out_credentialIds[i] = cred.credentialId;
        }
    }

    function getUserFromHashedCredentialId (bytes32 in_credentialIdHashed)
        internal view
        returns (User storage user)
    {
        bytes32 username = credentialsByHashedCredentialId[in_credentialIdHashed].username;

        require( username != bytes32(0x0), "getUserFromHashedCredentialId" );

        return users[username];
    }

    function getCredentialAndUser (bytes32 in_credentialIdHashed)
        internal view
        returns (User memory user, UserCredential memory credential)
    {
        user = getUserFromHashedCredentialId(in_credentialIdHashed);

        credential = credentialsByHashedCredentialId[in_credentialIdHashed];

        require( user.username == credential.username, "getCredentialAndUser" );
    }

    /**
     * Verify the clientDataJSON structure
     * @custom:see https://developer.mozilla.org/en-US/docs/Web/API/AuthenticatorResponse/clientDataJSON
     * @param in_challenge Authenticator challenge (32 bytes)
     * @param in_clientDataTokens JSON data split into key/value tokens (see: MakeJSON.sol)
     */
    function verifyClientDataTokens (
        bytes32 in_challenge,
        MakeJSON.KeyValue[] calldata in_clientDataTokens
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
            MakeJSON.KeyValue calldata item = in_clientDataTokens[i];
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

    function verifyECES256P256 (
        bytes32 in_credentialIdHashed,
        bytes32 in_challenge,
        AuthenticatorResponse calldata in_resp
    )
        public view
        returns (User memory user)
    {
        UserCredential memory credential;

        (user, credential) = getCredentialAndUser(in_credentialIdHashed);

        require( verifyClientDataTokens(in_challenge, in_resp.clientDataTokens), "verifyClientDataTokens" );

        string memory clientDataJSON = MakeJSON.from(in_resp.clientDataTokens);

        bytes32 digest = sha256(abi.encodePacked(in_resp.authenticatorData, sha256(abi.encodePacked(clientDataJSON))));

        require( SECP256R1.ecdsa_verify_raw(credential.pubkey, uint256(digest), in_resp.sigR, in_resp.sigS), "verifyECES256P256" );

        return user;
    }

    function proxyViewECES256P256(
        bytes32 in_credentialIdHashed,
        AuthenticatorResponse calldata in_resp,
        bytes memory in_data
    )
        public view
        returns (bytes memory out_data)
    {
        bytes32 challenge = sha256(in_data);

        User memory user = this.verifyECES256P256(in_credentialIdHashed, challenge, in_resp);

        in_data = abi.encodeWithSelector(Account.sign.selector, "");

        bool success;
        (success, out_data) = address(user.account).staticcall(in_data);

        assembly {
            switch success
            case 0 { revert(add(out_data,32),mload(out_data)) }
        }
    }
}
