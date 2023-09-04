// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {Base64URL} from "./Base64URL.sol";
import {HMAC_sha256} from "./OTPSHA256.sol";

library JWT {
    function HS256(
        bytes memory secret,
        string memory payload
    )
        external pure
        returns (string memory token)
    {
        string memory header = '{"alg":"HS256","typ":"JWT"}';

        bytes memory toSign = abi.encodePacked(
            Base64URL.encode(bytes(header)),
            ".",
            Base64URL.encode(bytes(payload))
        );

        bytes memory signedRaw = abi.encodePacked(HMAC_sha256(secret, toSign));

        return string(abi.encodePacked(
            toSign,
            ".",
            Base64URL.encode(signedRaw)
        ));
    }
}
