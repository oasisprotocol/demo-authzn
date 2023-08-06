// SPDX-License-Identifier: Apache-2

pragma solidity ^0.8.0;

// Borrowed from: https://github.com/TrueBitFoundation/scrypt-interactive/blob/ea81863045623856408184e968ca61eb1caa83f9/contracts/ScryptFramework.sol#L424
function HMAC_sha256(bytes memory key, bytes memory message)
    pure
    returns (bytes32)
{
    bytes32 keyl;
    bytes32 keyr;
    uint i;
    if (key.length > 64) {
        keyl = sha256(key);
    } else {
        for (i = 0; i < key.length && i < 32; i++) {
            keyl |= bytes32(uint256(uint8(key[i])) * 2**(8 * (31 - i)));
        }
        for (i = 32; i < key.length && i < 64; i++) {
            keyr |= bytes32(uint256(uint8(key[i])) * 2**(8 * (63 - i)));
        }
    }
    bytes32 threesix = 0x3636363636363636363636363636363636363636363636363636363636363636;
    bytes32 fivec = 0x5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c;
    return sha256(
        abi.encodePacked(fivec ^ keyl,
                         fivec ^ keyr,
                         sha256(
                            abi.encodePacked(
                                threesix ^ keyl,
                                threesix ^ keyr,
                                message))));
}

// See: https://en.wikipedia.org/wiki/HMAC-based_one-time_password
//      https://datatracker.ietf.org/doc/html/rfc4226
function HOTP_sha256(bytes memory K, uint64 C)
    pure
    returns (uint)
{
    bytes32 mac = HMAC_sha256(K, abi.encodePacked(C));
    uint8 offset = uint8(mac[31]) & 0x0f;
    uint res = (uint(uint8(mac[offset])) & 0x7f) << 24
             | uint(uint8(mac[offset + 1])) << 16
             | uint(uint8(mac[offset + 2])) << 8
             | uint(uint8(mac[offset + 3]));
    return res % (10**6);
}

function TOTP_sha256(bytes memory K, uint32 time_step, uint32 when)
    pure
    returns (uint)
{
    return HOTP_sha256(K, when / time_step);
}

contract OTPSHA256 {
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
