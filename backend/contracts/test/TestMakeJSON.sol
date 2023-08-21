// SPDX-License-Identifier: CC-PDDC

pragma solidity ^0.8.0;

import {MakeJSON} from "../lib/MakeJSON.sol";

contract TestMakeJSON {
    function testFrom(MakeJSON.KeyValue[] calldata items)
        public pure
        returns (string memory out)
    {
        return MakeJSON.from(items, 0);
    }
}
