// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {EthereumUtils, SignatureRSV} from "@oasisprotocol/sapphire-contracts/contracts/EthereumUtils.sol";

struct Point256 {
    uint256 x;
    uint256 y;
}

library SECP256R1Precompile
{
    uint private constant Secp256r1PrehashedSha256 = 7;
    address private constant SIGN_DIGEST = 0x0100000000000000000000000000000000000006;
    address private constant VERIFY_DIGEST = 0x0100000000000000000000000000000000000007;

    // See: https://neuromancer.sk/std/secg/secp256r1
    uint256 private constant A  = 0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc;
    uint256 private constant B  = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b;
    uint256 private constant N  = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551;
    uint256 private constant P  = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff;

    function toDERInteger(uint256 a)
        internal pure
        returns (bytes memory)
    {
        bool prefix = ((1<<255) & a) != 0;

        if( prefix ) {
            return abi.encodePacked(uint8(0x00), a);
        }

        return abi.encodePacked(a);
    }

    /**
     * Converts two uint256 values into a DER encoded ASN.1 SEQUENCE
     *
     * This is used to convert the EcDSA signature `r` and `s` values from their
     * individual components into a form accepted by the Sapphire signature
     * verification precompile.
     *
     * | 0x30 | len(z) | 0x02 | len(a) |  a   | 0x02 | len(b) |  b   | = hex value
     * |  1   |   1    |   1  |   1    | 1-33 |  1   |   1    | 1-33 | = byte length
     *
     * @return DER encoded ASN.1 SEQUENCE
     */
    function toDERSequence(uint256 a, uint256 b)
        internal pure
        returns (bytes memory)
    {
        bytes memory ab = toDERInteger(a);
        bytes memory bb = toDERInteger(b);

        bytes memory z = abi.encodePacked(
            uint8(0x02), uint8(ab.length), ab,
            uint8(0x02), uint8(bb.length), bb
        );

        return abi.encodePacked(
            uint8(0x30),
            uint8(z.length),
            z
        );
    }

    function toCompressedPubkey(uint256[2] memory p)
        internal pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            uint8(p[1] % 2 == 0 ? 0x02 : 0x03),
            p[0]
        );
    }

    /**
     * Verify curve equation y^2 == x^3 + a*x + b
     */
    function isOnCurve(uint x, uint y)
        public pure
        returns (bool)
    {
        if ( 0 == x || x >= P || 0 == y || y >= P) {
            return false;
        }

        uint LHS = mulmod(y, y, P); // y^2

        uint RHS = mulmod(mulmod(x, x, P), x, P); // x^3

        RHS = addmod(RHS, mulmod(x, A, P), P); // x^3 + a*x

        RHS = addmod(RHS, B, P); // x^3 + a*x + b

        return LHS == RHS;
    }

    function ecdsa_verify_raw(uint256[2] memory pubkey, uint256 z, uint256 r, uint256 s)
        internal view
        returns (bool)
    {
        bytes memory pkb = toCompressedPubkey(pubkey);
        bytes memory rsb = toDERSequence(r, s);

        (bool success, bytes memory v) = VERIFY_DIGEST.staticcall(
            abi.encode(Secp256r1PrehashedSha256, pkb, abi.encodePacked(bytes32(z)), "", rsb)
        );

        require(success, "verify: failed");

        return abi.decode(v, (bool));
    }

    function ecdsa_verify_raw(bytes memory pkb, bytes32 z, bytes memory sig)
        internal view
        returns (bool)
    {
        (bool success, bytes memory v) = VERIFY_DIGEST.staticcall(
            abi.encode(Secp256r1PrehashedSha256, pkb, abi.encodePacked(z), "", sig)
        );

        require(success, "verify: failed");

        return abi.decode(v, (bool));
    }

    function ecdsa_sign_raw(uint256 secretKey, uint256 z)
        internal view
        returns (uint256 r, uint256 s)
    {
        SignatureRSV memory rsv;

        (bool success, bytes memory sig) = SIGN_DIGEST.staticcall(
            abi.encode(Secp256r1PrehashedSha256, abi.encodePacked(secretKey), abi.encodePacked(z), "")
        );

        require(success, "sign: failed");

        rsv = EthereumUtils.splitDERSignature(sig);
        r = uint256(rsv.r);
        s = uint256(rsv.s);
    }
}
