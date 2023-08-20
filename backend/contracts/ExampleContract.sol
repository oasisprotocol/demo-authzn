// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

contract ExampleContract {
    event Hello(string data);

    function blah (string calldata dorp)
        public
    {
        emit Hello(dorp);
    }
}
