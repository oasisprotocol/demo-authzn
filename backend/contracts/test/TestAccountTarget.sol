// SPDX-License-Identifier: CC-PDDC

pragma solidity ^0.8.0;

contract TestAccountTarget {
    constructor () {}

    function exampleView()
        public view
        returns (address, address)
    {
        return (msg.sender, address(this));
    }

    event ExampleEvent(address, address);

    function example()
        public
    {
        emit ExampleEvent(msg.sender, address(this));
    }
}