// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {Point256, SECP256R1} from "./SECP256R1.sol";

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
}

contract WebAuthNExampleStorage {
    mapping(bytes32 => User) internal users;

    mapping(bytes32 => bytes32[]) internal usernameToHashedCredentialIdList;

    mapping(bytes32 => UserCredential) internal credentialsByHashedCredentialId;

    bytes32 internal challengeSecret;
}

contract WebAuthNExample is WebAuthNExampleStorage {
    bytes32 public salt;

    constructor () {
        challengeSecret = bytes32(Sapphire.randomBytes(32, abi.encodePacked(address(this))));
        salt = bytes32(Sapphire.randomBytes(32, abi.encodePacked(address(this))));
    }

    function userExists (bytes32 in_username)
        public view
        returns (bool)
    {
        User storage user = users[in_username];

        return user.username != bytes32(0x0);
    }

    /**
     * Deterministic per-keypair challenge
     * @param pubkey X & Y coordinates of EC point
     */
    function challenge (uint256[2] memory pubkey)
        public view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(challengeSecret, pubkey));
    }

    function registerECES256P256 (
        bytes32 in_username,
        bytes memory in_credentialId,
        CosePublicKey memory in_pubkey
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

    function verifyECES256P256 (
        bytes32 in_credentialIdHashed,
        bytes memory in_authenticatorData,
        bytes memory in_clientDataJSON,
        uint256 in_sigR,
        uint256 in_sigS
    )
        public view
        returns (bytes32)
    {
        (User memory user, UserCredential memory credential) = getCredentialAndUser(in_credentialIdHashed);

        bytes32 digest = sha256(abi.encodePacked(in_authenticatorData, sha256(in_clientDataJSON)));

        require( SECP256R1.ecdsa_verify_raw(credential.pubkey, uint256(digest), in_sigR, in_sigS), "verifyECES256P256" );

        return user.username;
    }
}
