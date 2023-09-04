// SPDX-License-Identifier: CC-PDDC

pragma solidity ^0.8.0;

import {Account,AccountFactory} from "../Account.sol";

contract TestAccount {
    AccountFactory private factory;
    event CloneCreated(address addr);
    constructor () {
        factory = new AccountFactory();
    }
    function testClone()
        public
    {
        Account acct = factory.clone(msg.sender);
        emit CloneCreated(address(acct));
    }
}
