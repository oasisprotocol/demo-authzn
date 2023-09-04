// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {JWT} from "../lib/JWT.sol";

contract TestJWT {
    function testHS256(bytes memory secret, string memory payload)
        public pure
        returns (string memory)
    {
        return JWT.HS256(secret, payload);
    }
}
