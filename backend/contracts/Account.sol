// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {SignatureRSV, EthereumUtils} from "@oasisprotocol/sapphire-contracts/contracts/EthereumUtils.sol";
import {EIP155Signer} from "@oasisprotocol/sapphire-contracts/contracts/EIP155Signer.sol";
import {CloneFactory} from "./lib/CloneFactory.sol";

contract AccountFactory is CloneFactory {
    Account private account;

    constructor () {
        account = new Account();
    }

    function clone (address starterOwner)
        public
        returns (Account acct)
    {
        acct = Account(createClone(address(account)));
        acct.init(starterOwner);
    }
}

contract Account {
    bool private _initialized;

    mapping(address => bool) private _controllers;

    address public keypairAddress;

    bytes32 private keypairSecret;

    constructor () {
        _initialized = true;
    }

    function isController (address who)
        public view
        returns (bool)
    {
        return _controllers[who];
    }

    function init (address starterOwner)
        public
    {
        require( ! _initialized, "AlreadyInitialized" );

        _controllers[starterOwner] = true;

        (keypairAddress, keypairSecret) = EthereumUtils.generateKeypair();

        _controllers[keypairAddress] = true;

        _initialized = true;
    }

    modifier onlyByController ()
    {
        require( _controllers[msg.sender] == true, "OnlyByController" );

        _;
    }

    function modifyController(address who, bool status)
        public
        onlyByController
    {
        _controllers[who] = status;
    }

    function signEIP155 (EIP155Signer.EthTx calldata txToSign)
        public view
        onlyByController
        returns (bytes memory)
    {
        return EIP155Signer.sign(keypairAddress, keypairSecret, txToSign);
    }

    function sign (bytes32 digest)
        public view
        onlyByController
        returns (SignatureRSV memory)
    {
        return EthereumUtils.sign(keypairAddress, keypairSecret, digest);
    }

    function transfer (address in_target, uint256 amount)
        public
        onlyByController
    {
        return payable(in_target).transfer(amount);
    }

    function call (address in_contract, bytes calldata in_data)
        public
        onlyByController
        returns (bytes memory out_data)
    {
        bool success;
        (success, out_data) = in_contract.call(in_data);
        assembly {
            switch success
            case 0 { revert(add(out_data,32),mload(out_data)) }
        }
    }

    function staticcall (address in_contract, bytes calldata in_data)
        public view
        onlyByController
        returns (bytes memory out_data)
    {
        bool success;
        (success, out_data) = in_contract.staticcall(in_data);
        assembly {
            switch success
            case 0 { revert(add(out_data,32),mload(out_data)) }
        }
    }
}
