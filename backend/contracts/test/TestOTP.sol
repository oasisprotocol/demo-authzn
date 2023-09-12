// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {SHA1} from "../lib/SHA1.sol";
import {HOTP_sha1, TOTP_sha1} from "../lib/OTPSHA1.sol";
import {HOTP_sha256, HMAC_sha256, TOTP_sha256} from "../lib/OTPSHA256.sol";

contract TestOTPSHA1 {
    function HOTP(bytes memory K, uint64 C)
        public pure
        returns (uint)
    {
        return HOTP_sha1(K, C);
    }

    function HMAC(bytes memory key, bytes memory message)
        public pure
        returns (bytes20)
    {
        return SHA1.HMAC(key, message);
    }

    function TOTP(bytes memory key, uint32 time_step, uint32 when)
        public pure
        returns (uint)
    {
        return TOTP_sha1(key, time_step, when);
    }
}

contract TestOTPSHA256 {
    function HOTP(bytes memory K, uint64 C)
        public pure
        returns (uint)
    {
        return HOTP_sha256(K, C);
    }

    function HMAC(bytes memory key, bytes memory message)
        public pure
        returns (bytes32)
    {
        return HMAC_sha256(key, message);
    }

    function TOTP(bytes memory key, uint32 time_step, uint32 when)
        public pure
        returns (uint)
    {
        return TOTP_sha256(key, time_step, when);
    }
}
