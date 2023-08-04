// SPDX-License-Identifier: CC-PDDC

pragma solidity ^0.8.0;

import {SECP256R1, Point256} from "../SECP256R1.sol";

contract TestP256R1 {
    function add (uint256 x1, uint256 y1, uint256 x2, uint256 y2)
        external view
        returns (uint256 x3, uint256 y3)
    {
        (x3, y3) = SECP256R1.sw_add_affine(x1, y1, x2, y2);
    }

    function double (uint256 x, uint256 y)
        external view
        returns (uint256 x2, uint256 y2)
    {
        (x2, y2) = SECP256R1.sw_double_affine(x, y);
    }

    function multiply (uint256 x0, uint256 y0, uint256 s)
        external view
        returns (uint256, uint256)
    {
        return SECP256R1.multiply_affine(x0, y0, s);
    }

    function ecdsa_sign_raw(uint256 secret, uint256 z)
        external view
        returns (uint256 r, uint256 s)
    {
        (r, s) = SECP256R1.ecdsa_sign_raw(secret, z);
    }

    function ecdsa_verify_raw(Point256 memory pubkey, uint256 z, uint256 r, uint256 s)
        external view
        returns (bool)
    {
        return SECP256R1.ecdsa_verify_raw(pubkey, z, r, s);
    }

    function isOnCurve(uint256 x, uint256 y)
        external pure
        returns (bool)
    {
        return SECP256R1.isOnCurve(x, y);
    }
}