// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

contract Account {
    bool private _initialized;

    mapping(address => bool) private _controllers;

    constructor () {
        _initialized = true;
    }

    function init (address starterOwner)
        public
    {
        require( _initialized == false );

        _controllers[starterOwner] = true;

        _initialized = true;
    }

    modifier onlyByController ()
    {
        require( _controllers[msg.sender] == true );

        _;
    }

    function modifyController(address who, bool status)
        public
        onlyByController
    {
        _controllers[who] = status;
    }

    function send (address in_target, uint256 amount)
        public
        onlyByController
        returns (bool)
    {
        return payable(in_target).send(amount);
    }

    function call (address in_contract, bytes calldata in_data)
        public
        onlyByController
        returns (bool success, bytes memory out_data)
    {
        (success, out_data) = in_contract.call(in_data);
    }

    function staticcall (address in_contract, bytes calldata in_data)
        public view
        onlyByController
        returns (bool success, bytes memory out_data)
    {
        (success, out_data) = in_contract.staticcall(in_data);
    }

    function delegatecall (address in_contract, bytes calldata in_data)
        public
        onlyByController
        returns (bool success, bytes memory out_data)
    {
        (success, out_data) = in_contract.delegatecall(in_data);
    }
}