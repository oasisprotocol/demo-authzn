// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {EthereumUtils} from "@oasisprotocol/sapphire-contracts/contracts/EthereumUtils.sol";
import {EIP155Signer} from "@oasisprotocol/sapphire-contracts/contracts/EIP155Signer.sol";

import {Account,AccountFactory} from "./lib/Account.sol";
import {WebAuthN,CosePublicKey,AuthenticatorResponse} from "./lib/WebAuthN.sol";


struct UserCredential {
    uint256[2] pubkey;
    bytes credentialId;
    bytes32 username;
}


struct User {
    bytes32 username;
    bytes32 password;
    Account account;
}


contract WebAuthNExampleStorage {

    mapping(bytes32 => User) internal users;

    mapping(bytes32 => bytes32[]) internal usernameToHashedCredentialIdList;

    mapping(bytes32 => UserCredential) internal credentialsByHashedCredentialId;

    bytes32 public salt;

    bytes32 public encryptionSecret;

    AccountFactory internal accountFactory;

    address public gaspayingAddress;

    bytes32 internal gaspayingSecret;
}


contract WebAuthNExample is WebAuthNExampleStorage
{
    constructor ()
        payable
    {
        salt = bytes32(Sapphire.randomBytes(32, abi.encodePacked(address(this))));

        encryptionSecret = bytes32(Sapphire.randomBytes(32, abi.encodePacked(address(this))));

        (gaspayingAddress, gaspayingSecret) = EthereumUtils.generateKeypair();

        accountFactory = new AccountFactory();

        if( msg.value > 0 ) {
            payable(gaspayingAddress).transfer(msg.value);
        }
    }


    function getAccount (bytes32 in_username)
        external view
        returns (Account account, address keypairAddress)
    {
        User storage user = users[in_username];

        account = user.account;

        keypairAddress = account.keypairAddress();
    }


    function userExists (bytes32 in_username)
        public view
        returns (bool)
    {
        User storage user = users[in_username];

        return user.username != bytes32(0x0);
    }

    /**
     *
     * @param in_hashedUsername PBKDF2 hashed username
     * @param in_credentialId Raw credentialId provided by WebAuthN compatible authenticator
     * @param in_pubkey Public key extracted from authenticatorData
     */
    function internal_registerCredential(
        bytes32 in_hashedUsername,
        bytes memory in_credentialId,
        CosePublicKey memory in_pubkey
    )
        internal
    {
        // Ensure public key validity before registration
        require( WebAuthN.verifyPubkey(in_pubkey), "WebAuthN.verifyPubkey" );

        bytes32 hashedCredentialId = keccak256(in_credentialId);

        // Credential must not previously exist or be associated with a user
        require(  credentialsByHashedCredentialId[hashedCredentialId].username == bytes32(0) );

        // Add credential to user
        credentialsByHashedCredentialId[hashedCredentialId] = UserCredential({
            pubkey: [in_pubkey.x, in_pubkey.y],
            credentialId: in_credentialId,
            username: in_hashedUsername
        });

        usernameToHashedCredentialIdList[in_hashedUsername].push(hashedCredentialId);
    }

    function internal_register(bytes32 in_hashedUsername, bytes32 in_optionalPassword)
        internal
        returns (User storage user)
    {
        user = users[in_hashedUsername];
        user.username = in_hashedUsername;
        user.account = accountFactory.clone(address(this));
        user.password = in_optionalPassword;
    }

    struct RegisterECES256P256 {
        bytes32 hashedUsername;
        bytes credentialId;
        CosePublicKey pubkey;
        bytes32 optionalPassword;
    }

    function encrypted_registerECES256P256 (bytes32 nonce, bytes memory ciphertext)
        external
    {
        bytes memory plaintext = Sapphire.decrypt(encryptionSecret, nonce, ciphertext, abi.encodePacked(address(this)));

        RegisterECES256P256 memory args = abi.decode(plaintext, (RegisterECES256P256));

        // Don't allow duplicate registrations
        require( ! userExists(args.hashedUsername), "registerECES256P256: user exists" );

        internal_register(args.hashedUsername, args.optionalPassword);

        internal_registerCredential(args.hashedUsername, args.credentialId, args.pubkey);
    }

    function gasless_registerECES256P256 (
        RegisterECES256P256 calldata args,
        uint64 nonce,
        uint256 gasPrice
    )
        external view
        returns (bytes memory)
    {
        require( ! userExists(args.hashedUsername), "gasless_registerECES256P256: user exists" );

        bytes memory plainText = abi.encode(args);

        bytes32 cipherNonce = bytes32(Sapphire.randomBytes(32, abi.encode(
            args,
            nonce,
            gasPrice
        )));

        bytes memory cipherPersonalization = abi.encodePacked(address(this));

        bytes memory cipherBytes = Sapphire.encrypt(
            encryptionSecret,
            cipherNonce,
            plainText,
            cipherPersonalization);

        EIP155Signer.EthTx memory gaslessTx = EIP155Signer.EthTx({
            nonce: nonce,
            gasPrice: gasPrice,
            gasLimit: 1000000,
            to: address(this),
            value: 0,
            data: abi.encodeCall(
                this.encrypted_registerECES256P256,
                (cipherNonce, cipherBytes)
            ),
            chainId: block.chainid
        });

        return EIP155Signer.sign(gaspayingAddress, gaspayingSecret, gaslessTx);
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

    function internal_getUserFromHashedCredentialId (bytes32 in_credentialIdHashed)
        internal view
        returns (User storage user)
    {
        bytes32 username = credentialsByHashedCredentialId[in_credentialIdHashed].username;

        require( username != bytes32(0x0), "getUserFromHashedCredentialId" );

        return users[username];
    }

    function internal_getCredentialAndUser (bytes32 in_credentialIdHashed)
        internal view
        returns (
            User storage user,
            UserCredential storage credential
        )
    {
        user = internal_getUserFromHashedCredentialId(in_credentialIdHashed);

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

        (user, credential) = internal_getCredentialAndUser(in_credentialIdHashed);

        require( WebAuthN.verifyECES256P256(in_challenge, credential.pubkey, in_resp) );

        return user;
    }

    function internal_proxyView(
        User storage user,
        bytes calldata in_data
    )
        internal view
        returns (bytes memory out_data)
    {
        bool success;

        (success, out_data) = address(user.account).staticcall(abi.encodeWithSelector(Account.sign.selector, in_data));

        assembly {
            switch success
            case 0 { revert(add(out_data,32),mload(out_data)) }
        }
    }

    function proxyViewPassword(
        bytes32 in_hashedUsername,
        bytes32 in_digest,
        bytes calldata in_data
    )
        external view
        returns (bytes memory out_data)
    {
        User storage user = users[in_hashedUsername];

        require( user.username != bytes32(0) );

        require( user.password != bytes32(0) );

        require( keccak256(abi.encodePacked(user.password, in_data)) == in_digest );

        return internal_proxyView(user, in_data);
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
        external view
        returns (bytes memory out_data)
    {
        bytes32 personalization = sha256(abi.encodePacked(block.chainid, address(this), salt));

        bytes32 challenge = sha256(abi.encodePacked(personalization, sha256(in_data)));

        User storage user = internal_verifyECES256P256(in_credentialIdHashed, challenge, in_resp);

        return internal_proxyView(user, in_data);
    }
}
