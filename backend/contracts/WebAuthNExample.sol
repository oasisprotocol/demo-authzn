// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {Account,AccountFactory} from "./lib/Account.sol";
import {WebAuthN,CosePublicKey,AuthenticatorResponse} from "./lib/WebAuthN.sol";


struct UserCredential {
    uint256[2] pubkey;
    bytes credentialId;
    bytes32 username;
}


struct User {
    bytes32 username;
    Account account;
}


contract WebAuthNExampleStorage {

    mapping(bytes32 => User) internal users;

    mapping(bytes32 => bytes32[]) internal usernameToHashedCredentialIdList;

    mapping(bytes32 => UserCredential) internal credentialsByHashedCredentialId;

    bytes32 public salt;
}


contract WebAuthNExample is WebAuthNExampleStorage
{
    AccountFactory private accountFactory;


    constructor ()
    {
        salt = bytes32(Sapphire.randomBytes(32, abi.encodePacked(address(this))));

        accountFactory = new AccountFactory();
    }


    function getUser (bytes32 in_username)
        public view
        returns (User memory user)
    {
        user = users[in_username];
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

        // Ensure public key validity before registration
        require( WebAuthN.verifyPubkey(in_pubkey), "WebAuthN.verifyPubkey" );

        User storage user = users[in_username];
        user.username = in_username;
        user.account = accountFactory.clone(address(this));

        bytes32 hashedCredentialId = keccak256(in_credentialId);

        credentialsByHashedCredentialId[hashedCredentialId] = UserCredential({
            pubkey: [in_pubkey.x, in_pubkey.y],
            credentialId: in_credentialId,
            username: in_username
        });

        usernameToHashedCredentialIdList[in_username].push(hashedCredentialId);
    }


    /**
     * Retrieve a list of credential IDs for a specific user
     * @param in_hashedUsername Hashed username
     */
    function credentialIdsByUsername(bytes32 in_hashedUsername)
        public view
        returns (bytes[] memory out_credentialIds)
    {
        require( userExists(in_hashedUsername), "credentialIdsByUsername" );

        bytes32[] storage credentialIdHashes = usernameToHashedCredentialIdList[in_hashedUsername];

        uint length = credentialIdHashes.length;

        out_credentialIds = new bytes[](length);

        for( uint i = 0; i < length; i++ )
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
        returns (
            User storage user,
            UserCredential storage credential
        )
    {
        user = getUserFromHashedCredentialId(in_credentialIdHashed);

        credential = credentialsByHashedCredentialId[in_credentialIdHashed];

        require( user.username == credential.username, "getCredentialAndUser" );
    }


    function internal_verifyECES256P256 (
        bytes32 in_credentialIdHashed,
        bytes32 in_challenge,
        AuthenticatorResponse calldata in_resp
    )
        internal view
        returns (User storage user)
    {
        UserCredential storage credential;

        (user, credential) = getCredentialAndUser(in_credentialIdHashed);

        require( WebAuthN.verifyECES256P256(in_challenge, credential.pubkey, in_resp) );

        return user;
    }


    function verifyECES256P256 (
        bytes32 in_credentialIdHashed,
        bytes32 in_challenge,
        AuthenticatorResponse calldata in_resp
    )
        public view
        returns (User memory user)
    {
        return internal_verifyECES256P256(in_credentialIdHashed, in_challenge, in_resp);
    }


    /**
     * Performs a proxied call to the verified users account
     *
     * @param in_credentialIdHashed .
     * @param in_resp Authenticator response
     * @param in_data calldata to pass to account proxy
     * @return out_data result from proxied view call
     */
    function proxyViewECES256P256(
        bytes32 in_credentialIdHashed,
        AuthenticatorResponse calldata in_resp,
        bytes calldata in_data
    )
        public view
        returns (bytes memory out_data)
    {
        bytes32 personalization = sha256(abi.encodePacked(block.chainid, address(this), salt));

        bytes32 challenge = sha256(abi.encodePacked(personalization, sha256(in_data)));

        User storage user = internal_verifyECES256P256(in_credentialIdHashed, challenge, in_resp);

        bool success;

        (success, out_data) = address(user.account).staticcall(abi.encodeWithSelector(Account.sign.selector, in_data));

        assembly {
            switch success
            case 0 { revert(add(out_data,32),mload(out_data)) }
        }
    }
}
