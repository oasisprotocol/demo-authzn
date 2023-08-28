// SPDX-License-Identifier: CC-PDDC

pragma solidity ^0.8.0;

import {parseAuthenticatorData,AuthenticatorData} from "../lib/WebAuthN.sol";

contract TestWebAuthN {
    function testParseAuthData(bytes calldata in_data)
        public pure
        returns (AuthenticatorData memory)
    {
        return parseAuthenticatorData(in_data);
    }
}
