// SPDX-License-Identifier: CC-PDDC

pragma solidity ^0.8.0;

library MakeJSON {
    enum ValueType {
        JSONString,
        JSONBool
    }

    struct KeyValue {
        ValueType t;
        string k;
        string v;
    }

    bytes32 constant internal BOOL_TRUE = keccak256(abi.encodePacked("true"));

    function from(KeyValue[] memory items)
        internal pure
        returns (string memory out)
    {
        return from(items, 0);
    }

    function from(KeyValue[] memory items, uint offset)
        internal pure
        returns (string memory out)
    {
        KeyValue memory x = items[offset];

        string memory next;

        if( offset == items.length - 1 )
        {
            // Terminal item, return empty
            next = "}";
        }
        else{
            // Otherwise, continue constructing JSON result
            next = from(items, offset + 1);
        }

        if( x.t == ValueType.JSONString )
        {
            if( offset == 0 ) {
                return string(abi.encodePacked("{\"", x.k, "\":\"", x.v, "\"", next));
            }
            return string(abi.encodePacked(",\"", x.k, "\":\"", x.v, "\"", next));
        }
        else if( x.t == ValueType.JSONBool )
        {
            bool val = keccak256(abi.encodePacked(x.v)) == BOOL_TRUE;

            if( offset == 0 )
            {
                if( val ) {
                    return string(abi.encodePacked("{\"", x.k, "\":true", next));
                }
                return string(abi.encodePacked("{\"", x.k, "\":false", next));
            }
            else {
                if( val ) {
                    return string(abi.encodePacked(",\"", x.k, "\":true", next));
                }
                return string(abi.encodePacked(",\"", x.k, "\":false", next));
            }
        }

        require( false, "MakeJSON.ValueType.unknown!" );
    }
}
