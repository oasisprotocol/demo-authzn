// SPDX-License-Identifier: CC-PDDC

pragma solidity ^0.8.0;

import {Base64URL} from "../lib/Base64URL.sol";

contract TestBase64 {
    function testEncode(bytes memory input)
        public pure
        returns (string memory)
    {
        return Base64URL.encode(input);
    }

    function testDecode(string memory input)
        public pure
        returns (bytes memory)
    {
        return Base64URL.decode(input);
    }
}
