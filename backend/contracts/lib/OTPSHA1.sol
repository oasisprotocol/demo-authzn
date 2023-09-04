// SPDX-License-Identifier: MIT
/*
The MIT License (MIT)

Copyright (c) 2016 chriseth
Copyright (c) 2023 oasisprotocol.org

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

pragma solidity ^0.8.0;

import {SHA1} from "./SHA1.sol";

// See: https://en.wikipedia.org/wiki/HMAC-based_one-time_password
//      https://datatracker.ietf.org/doc/html/rfc4226
function HOTP_sha1(bytes memory K, uint64 C)
    pure
    returns (uint)
{
    bytes20 mac = SHA1.HMAC(K, abi.encodePacked(C));
    uint8 offset = uint8(mac[19]) & 0x0f;
    uint res = (uint(uint8(mac[offset])) & 0x7f) << 24
             | uint(uint8(mac[offset + 1])) << 16
             | uint(uint8(mac[offset + 2])) << 8
             | uint(uint8(mac[offset + 3]));
    return res % (10**6);
}

function TOTP_sha1(bytes memory K, uint32 time_step, uint32 when)
    pure
    returns (uint)
{
    return HOTP_sha1(K, when / time_step);
}
