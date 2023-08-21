// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

struct Point256 {
    uint256 x;
    uint256 y;
}

/**
 * (near) Constant-gas implementation of SEC P256 R1 (1.2.840.10045.3.1.7)
 * Currently costs about 1.5m gas for a scalar multiply
 *  - the sw_add function will leak a small amount of information
 *  - as it requires a special case when the input is zero...
 *
 * See the iacr-2015-1060.py file which extracts algorithms from https://eprint.iacr.org/2015/1060.pdf
 */
library SECP256R1
{
    // See: https://neuromancer.sk/std/secg/secp256r1
    uint256 private constant A  = 0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc;
    uint256 private constant B  = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b;
    uint256 private constant B3 = 0x1052a18afeafbbb61bc3380063c994352f57141164fb12e2b36ab4ba777720e2;
    uint256 public  constant Gx = 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296;
    uint256 public  constant Gy = 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5;
    uint256 private constant N  = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551;
    uint256 private constant P  = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff;

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

    /**
     * See: https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm
     */
    function ecdsa_verify_raw(Point256 memory pubkey, uint256 z, uint256 r, uint256 s)
        internal view
        returns (bool)
    {
        // Pre-checks, verify public-key
        // 1. check pubkey is not identity element
        // 2. validate pubkey
        if( ! isOnCurve(pubkey.x, pubkey.y) ) return false;

        // TODO: 3. check N*pubkey == identity element
        //  XXX: this is impractical as it costs lots of gas!

        // Then verify the signature
        // 1. Verify that r and s are integers in [ 1 , n − 1 ] [1,n-1]. If not, the signature is invalid.
        if( r == 0 && r >= N ) return false;
        if( s == 0 && s >= N ) return false;

        // 2. Calculate `e = HASH(m)` where HASH is the same function used in the signature generation.
        // 3. Let `z` be the `L_n` leftmost bits of `e`.
        // ... (e=HASH(m) is precomputed as `z` before invoking this function)

        // 4. Calculate `u_1 = z s − 1 mod n`
        //          and `u_2 = r s − 1 mod n`
        uint256 s_inv = inverse(s, N);
        uint256 u1 = mulmod(z, s_inv, N);
        uint256 u2 = mulmod(r, s_inv, N);

        // 5. Calculate the curve point `(x_1, y_1) = (u_1 × G) + (u_2 × Q_A)`
        (uint256 ax, uint256 ay, uint256 az) = multiply(Gx, Gy, u1);
        (uint256 bx, uint256 by, uint256 bz) = multiply(pubkey.x, pubkey.y, u2);
        (ax, ay, az) = sw_add(ax, ay, az, bx, by, bz);
        (ax, ay) = to_affine(ax, ay, az);

        // 5.1 If `(x_1, y_1) = O` (identity element) then the signature is invalid.
        if( ax == 0 || ay == 0 ) return false;

        // 6. The signature is valid if `r ≡ x 1 (mod n)`
        return r == (ax % N);
    }

    function ecdsa_verify_sha256(bytes memory message, Point256 memory pubkey, uint256 r, uint256 s)
        internal view
        returns (bool)
    {
        return ecdsa_verify_raw(pubkey, uint(sha256(message)), r, s);
    }

    /**
     * `z = e = HASH(m)` when using a 256bit hash
     *
     * Note: `z` can be greater than `N` but not longer
     *
     * Note: `k` is derived deterministically from the secret key and message
     *
     * See: https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm#Signature_generation_algorithm
     *
     * @param z the `L_n` leftmost bits of `e`, where `L_n` is the bit length of the group order `N`.
     */
    function ecdsa_sign_raw(uint256 secretkey, uint256 z)
        internal view
        returns (uint256 r, uint256 s)
    {
        uint256 k = 0;

        while( true )
        {
            // Sample `k` deterministically until it's in range of `[1,N-1]`
            do {
                k = uint256(keccak256(abi.encodePacked(secretkey, z, k)));
            } while( k == 0 || k >= N );

            (uint256 kx,) = multiply_affine(Gx, Gy, k);

            // 5. Calculate `r = x_1 mod n`.
            r = kx % N;
            if( r == 0 ) {
                continue;
            }

            // 6. Calculate `s = k^{-1}(z + rd_A) mod n`
            s = mulmod(inverse(k, N), addmod(z, mulmod(r, secretkey, N), N), N);
            if( s == 0 ) {
                continue;
            }

            break;
        }
    }

    /**
     * See: https://en.wikipedia.org/wiki/Fermat%27s_little_theorem
     *
     *  a^(p-1) = 1 mod p
     *  a^(-1) ≅ a^(p-2) (mod p)
     *
     * Then use the precompile bigModExp to compute a^(-1)
     */
    function inverse(uint256 x, uint256 field)
        internal view
        returns (uint256 result)
    {
        bool success;
        assembly {
            let freemem := mload(0x40)
            mstore(freemem, 0x20)
            mstore(add(freemem,0x20), 0x20)
            mstore(add(freemem,0x40), 0x20)
            mstore(add(freemem,0x60), x)
            mstore(add(freemem,0x80), sub(field, 2))
            mstore(add(freemem,0xA0), field)
            success := staticcall(gas(), 5, freemem, 0xC0, freemem, 0x20)
            result := mload(freemem)
        }
        require(success, "SECP256R1.inverse!");
    }

    function submod(uint256 x, uint256 y)
        internal pure
        returns (uint256)
    {
        unchecked {
            return addmod(x, (P-y), P);
        }
    }

    function sw_add_affine(
        uint256 X1, uint256 Y1,
        uint256 X2, uint256 Y2
    )
        internal view
        returns (uint256 X3, uint256 Y3)
    {
        uint256 Z3;

        (X3, Y3, Z3) = sw_add(X1, Y1, 1, X2, Y2, 1);

        (X3, Y3) = to_affine(X3, Y3, Z3);
    }

    // https://eprint.iacr.org/2015/1060.pdf
    // Page 8, Sec 3.1, Algorithm 1: Complete, projective point addition for
    // arbitrary prime order short Weierstrass curves E/Fq : y2 = x3 + ax + b.
    function sw_add(
        uint256 X1, uint256 Y1, uint256 Z1,
        uint256 X2, uint256 Y2, uint256 Z2
    )
        internal pure
        returns (uint256 X3, uint256 Y3, uint256 Z3)
    {
        unchecked {
            uint256 t0;
            uint256 t1;
            uint256 t2;
            uint256 t3;
            uint256 t4;
            uint256 t5;

            // TODO: remove this, it should be constant time!
            if( X1 == 0 && Y1 == 0 ) {
                return (X2, Y2, Z2);
            }
            if( X2 == 0 && Y2 == 0 ) {
                return (X1, Y1, Z1);
            }

            t0 = mulmod(X1, X2, P); //  1. t0 ← X1 · X2
            t1 = mulmod(Y1, Y2, P); //  2. t1 ← Y1 · Y2
            t2 = mulmod(Z1, Z2, P); //  3. t2 ← Z1 · Z2
            t3 = addmod(X1, Y1, P); //  4. t3 ← X1 + Y1
            t4 = addmod(X2, Y2, P); //  5. t4 ← X2 + Y2
            t3 = mulmod(t3, t4, P); //  6. t3 ← t3 · t4
            t4 = addmod(t0, t1, P); //  7. t4 ← t0 + t1
            t3 = submod(t3, t4);    //  8. t3 ← t3 − t4
            t4 = addmod(X1, Z1, P); //  9. t4 ← X1 + Z1
            t5 = addmod(X2, Z2, P); // 10. t5 ← X2 + Z2
            t4 = mulmod(t4, t5, P); // 11. t4 ← t4 · t5
            t5 = addmod(t0, t2, P); // 12. t5 ← t0 + t2
            t4 = submod(t4, t5);    // 13. t4 ← t4 − t5
            t5 = addmod(Y1, Z1, P); // 14. t5 ← Y1 + Z1
            X3 = addmod(Y2, Z2, P); // 15. X3 ← Y2 + Z2
            t5 = mulmod(t5, X3, P); // 16. t5 ← t5 · X3
            X3 = addmod(t1, t2, P); // 17. X3 ← t1 + t2
            t5 = submod(t5, X3);    // 18. t5 ← t5 − X3
            Z3 = mulmod(A,  t4, P); // 19. Z3 ←  a · t4
            X3 = mulmod(B3, t2, P); // 20. X3 ← b3 · t2
            Z3 = addmod(X3, Z3, P); // 21. Z3 ← X3 + Z3
            X3 = submod(t1, Z3);    // 22. X3 ← t1 − Z3
            Z3 = addmod(t1, Z3, P); // 23. Z3 ← t1 + Z3
            Y3 = mulmod(X3, Z3, P); // 24. Y3 ← X3 · Z3
            t1 = addmod(t0, t0, P); // 25. t1 ← t0 + t0
            t1 = addmod(t1, t0, P); // 26. t1 ← t1 + t0
            t2 = mulmod(A,  t2, P); // 27. t2 ←  a · t2
            t4 = mulmod(B3, t4, P); // 28. t4 ← b3 · t4
            t1 = addmod(t1, t2, P); // 29. t1 ← t1 + t2
            t2 = submod(t0, t2);    // 30. t2 ← t0 − t2
            t2 = mulmod(A,  t2, P); // 31. t2 ←  a · t2
            t4 = addmod(t4, t2, P); // 32. t4 ← t4 + t2
            t0 = mulmod(t1, t4, P); // 33. t0 ← t1 · t4
            Y3 = addmod(Y3, t0, P); // 34. Y3 ← Y3 + t0
            t0 = mulmod(t5, t4, P); // 35. t0 ← t5 · t4
            X3 = mulmod(t3, X3, P); // 36. X3 ← t3 · X3
            X3 = submod(X3, t0);    // 37. X3 ← X3 − t0
            t0 = mulmod(t3, t1, P); // 38. t0 ← t3 · t1
            Z3 = mulmod(t5, Z3, P); // 39. Z3 ← t5 · Z3
            Z3 = addmod(Z3, t0, P); // 40. Z3 ← Z3 + t0
        }
    }

    function sw_double_affine(
        uint256 X, uint256 Y
    )
        internal view
        returns(uint256 X3, uint256 Y3)
    {
        uint256 Z3;

        (X3, Y3, Z3) = sw_double(X, Y, 1);

        (X3, Y3) = to_affine(X3, Y3, Z3);
    }

    // https://eprint.iacr.org/2015/1060.pdf
    // Page 10, Sec 3.1, Algorithm 3: Exception-free point doubling for
    // arbitrary prime order short Weierstrass curves E/Fq : y2 = x3 + ax + b.
    function sw_double(
        uint256 X, uint256 Y, uint256 Z
    )
        internal pure
        returns(uint256 X3, uint256 Y3, uint256 Z3)
    {
        unchecked {
            uint256 t0;
            uint256 t1;
            uint256 t2;
            uint256 t3;

            t0 = mulmod(X,  X,  P); //  1. t0 ←  X ·  X
            t1 = mulmod(Y,  Y,  P); //  2. t1 ←  Y ·  Y
            t2 = mulmod(Z,  Z,  P); //  3. t2 ←  Z ·  Z
            t3 = mulmod(X,  Y,  P); //  4. t3 ←  X ·  Y
            t3 = addmod(t3, t3, P); //  5. t3 ← t3 + t3
            Z3 = mulmod(X,  Z,  P); //  6. Z3 ←  X ·  Z
            Z3 = addmod(Z3, Z3, P); //  7. Z3 ← Z3 + Z3
            X3 = mulmod(A,  Z3, P); //  8. X3 ←  a · Z3
            Y3 = mulmod(B3, t2, P); //  9. Y3 ← b3 · t2
            Y3 = addmod(X3, Y3, P); // 10. Y3 ← X3 + Y3
            X3 = submod(t1, Y3);    // 11. X3 ← t1 − Y3
            Y3 = addmod(t1, Y3, P); // 12. Y3 ← t1 + Y3
            Y3 = mulmod(X3, Y3, P); // 13. Y3 ← X3 · Y3
            X3 = mulmod(t3, X3, P); // 14. X3 ← t3 · X3
            Z3 = mulmod(B3, Z3, P); // 15. Z3 ← b3 · Z3
            t2 = mulmod(A,  t2, P); // 16. t2 ←  a · t2
            t3 = submod(t0, t2);    // 17. t3 ← t0 − t2
            t3 = mulmod(A,  t3, P); // 18. t3 ←  a · t3
            t3 = addmod(t3, Z3, P); // 19. t3 ← t3 + Z3
            Z3 = addmod(t0, t0, P); // 20. Z3 ← t0 + t0
            t0 = addmod(Z3, t0, P); // 21. t0 ← Z3 + t0
            t0 = addmod(t0, t2, P); // 22. t0 ← t0 + t2
            t0 = mulmod(t0, t3, P); // 23. t0 ← t0 · t3
            Y3 = addmod(Y3, t0, P); // 24. Y3 ← Y3 + t0
            t2 = mulmod(Y,  Z,  P); // 25. t2 ←  Y ·  Z
            t2 = addmod(t2, t2, P); // 26. t2 ← t2 + t2
            t0 = mulmod(t2, t3, P); // 27. t0 ← t2 · t3
            X3 = submod(X3, t0);    // 28. X3 ← X3 − t0
            Z3 = mulmod(t2, t1, P); // 29. Z3 ← t2 · t1
            Z3 = addmod(Z3, Z3, P); // 30. Z3 ← Z3 + Z3
            Z3 = addmod(Z3, Z3, P); // 31. Z3 ← Z3 + Z3
        }
    }

    /**
     * Transform from projective to affine coordinates
     *
     * @return x1 = x0/z0
     * @return y1 = y1/z0
     */
    function to_affine(uint256 x0, uint256 y0, uint256 z0)
        internal view
        returns(uint256 x1, uint256 y1)
    {
        unchecked {
            uint256 z0Inv = inverse(z0, P);

            x1 = mulmod(x0, z0Inv, P);

            y1 = mulmod(y0, z0Inv, P);
        }
    }

    // Multiply an elliptic curve point in a scalar
    function multiply(uint256 x0, uint256 y0, uint scalar)
        internal pure
        returns(uint256 x1, uint256 y1, uint256 z1)
    {
        scalar = scalar % N;

        if( scalar == 0 ) {
            return (0, 0, 1);
        }

        unchecked {
            uint256 base2X = x0;
            uint256 base2Y = y0;
            uint256 base2Z = 1;

            x1 = x0 * (scalar & 1);
            y1 = y0 * (scalar & 1);
            z1 = 1;

            scalar = scalar >> 1;

            for( uint i = 0; i < 255; i++ ) {
                (base2X, base2Y, base2Z) = sw_double(base2X, base2Y, base2Z);

                (uint256 t_x, uint256 t_y, uint256 t_z) = sw_add(base2X, base2Y, base2Z, x1, y1, z1);

                // Constant time conditional select/move
                // if bit is on choose sw_add result
                uint256 c = scalar & 1;
                uint256 d = 1 - c;
                x1 = (d*x1) + (c*t_x);
                y1 = (d*y1) + (c*t_y);
                z1 = (d*z1) + (c*t_z);

                scalar = scalar >> 1;
            }
        }
    }

    function multiply_affine(uint256 x0, uint256 y0, uint scalar)
        internal view
        returns(uint256 x1, uint256 y1)
    {
        uint256 z1;

        (x1, y1, z1) = multiply(x0, y0, scalar);

        return to_affine(x1, y1, z1);
    }
}
