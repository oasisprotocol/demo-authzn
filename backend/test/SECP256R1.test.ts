// SPDX-License-Identifier: Apache-2.0

import { TestP256R1 } from "../typechain-types";
import { ethers } from "hardhat"
import { ec } from "elliptic";
import crypto from 'crypto';
import { expect } from "chai";
import { bufToHex } from 'bigint-conversion'
import BN from 'bn.js';
import { BigNumber } from "ethers";

const secp256r1 = new ec('p256');

function bn2u256(x:BN) {
    return '0x' + x.toString('hex').padStart(64, '0');
}

describe('SECP256R1', () => {
    let c: TestP256R1;

    before(async () => {
        const lf = await ethers.getContractFactory('SECP256R1');
        const ll = await lf.deploy();
        await ll.deployed();

        const f = await ethers.getContractFactory('TestP256R1', {libraries: {SECP256R1: ll.address}});
        c = await f.deploy()
        await c.deployed();
    });

    it('Addition', async () => {
        for( let i = 0; i < 10; i++ ) {
            const kp1 = secp256r1.genKeyPair().getPublic();
            const x1 = bn2u256(kp1.getX());
            const y1 = bn2u256(kp1.getY());

            const kp2 = secp256r1.genKeyPair().getPublic();
            const x2 = bn2u256(kp2.getX());
            const y2 = bn2u256(kp2.getY());

            const kp3 = kp1.add(kp2);
            const x3 = bn2u256(kp3.getX());
            const y3 = bn2u256(kp3.getY());

            const z = await c.add(x1, y1, x2, y2);
            expect(z.x3).equal(x3);
            expect(z.y3).equal(y3);
        }
    });

    it('Doubling', async () => {
        for( let i = 0; i < 10; i++ ) {
            const kp1 = secp256r1.genKeyPair().getPublic();
            const x1 = bn2u256(kp1.getX());
            const y1 = bn2u256(kp1.getY());

            const kp2 = kp1.dbl();
            const x2 = bn2u256(kp2.getX());
            const y2 = bn2u256(kp2.getY());

            const z = await c.double(x1, y1);
            expect(z.x2).equal(x2);
            expect(z.y2).equal(y2);
        }
    });

    it('Multiply', async () => {
        for( let i = 1; i < 20; i++ ) {
            const kp1 = secp256r1.genKeyPair().getPublic();

            const x1 = bn2u256(kp1.getX());
            const y1 = bn2u256(kp1.getY());
            const secret = new BN(bufToHex(crypto.getRandomValues(new Uint8Array(32))), 16).mod(secp256r1.n!);
            const kp2 = kp1.mul(secret);

            const sbn = bn2u256(secret);

            const x2 = bn2u256(kp2.getX());
            const y2 = bn2u256(kp2.getY());
            const kp3 = await c.multiply(x1, y1, sbn);

            expect(x2).eq(kp3[0]);
            expect(y2).eq(kp3[1]);
        }
    });

    // Used to wrap signatures so they're acceptable by EC library
    class SolSignature {
        r: BN;
        s: BN;
        recoveryParam: number | null;

        constructor(sig: {r: BigNumber, s: BigNumber})
        {
            this.r = new BN(sig.r.toHexString().slice(2), 16),
            this.s = new BN(sig.s.toHexString().slice(2), 16),
            this.recoveryParam = null;
        }

        toDER(): number[];
        toDER(enc: "hex"): string;
        toDER(): string|number[] {
            throw new Error("toDER: not implemented!");
        }
    }

    it('EcDSA', async () => {
        for( let i = 0; i < 5; i++ )
        {
            const msg = new BN(bufToHex(crypto.getRandomValues(new Uint8Array(32))), 16);
            const kp = secp256r1.genKeyPair();

            const secret = bn2u256(kp.getPrivate());
            const pk = {
                x: bn2u256(kp.getPublic().getX()),
                y: bn2u256(kp.getPublic().getY())
            };

            const solsig = await c.ecdsa_sign_raw(secret, bn2u256(msg));

            // Verify Solidity signature in JS
            const jsressol = secp256r1.verify(msg, new SolSignature(solsig), kp);
            expect(jsressol).eq(true);

            // Verify Solidity signature in Solidity
            const ressol = await c.ecdsa_verify_raw(pk, bn2u256(msg), solsig.r, solsig.s);
            expect(ressol).eq(true);

            // Verify JS signature in Solidity
            const sigjs = secp256r1.sign(msg, kp);
            const resjs = await c.ecdsa_verify_raw(pk, bn2u256(msg), bn2u256(sigjs.r), bn2u256(sigjs.s));
            expect(resjs).eq(true);
        }
    });
})