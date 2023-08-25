// SPDX-License-Identifier: Apache-2.0

import { TestP256R1 } from "../typechain-types";
import { ethers } from "hardhat"
import { ec } from "elliptic";
import { getRandomValues } from 'crypto';
import { expect } from "chai";
import BN from 'bn.js';

const secp256r1 = new ec('p256');

function bn2u256(x:BN) {
    return '0x' + x.toString('hex').padStart(64, '0');
}

describe('SECP256R1', () => {
    let c: TestP256R1;

    before(async () => {
        const lf = await ethers.getContractFactory('SECP256R1');
        const ll = await lf.deploy();
        await ll.waitForDeployment();

        const f = await ethers.getContractFactory('TestP256R1', {libraries: {SECP256R1: await ll.getAddress()}});
        c = await f.deploy()
        await c.waitForDeployment();
    });

    it('Multiply by Order is Identity Element!', async () => {
        const kp = secp256r1.genKeyPair();
        const pk = kp.getPublic();
        const x1 = bn2u256(pk.getX());
        const y1 = bn2u256(pk.getY());
        const s = bn2u256(secp256r1.n!);
        const r = await c.multiply(x1, y1, s);
        expect(r[0]).eq(0);
        expect(r[1]).eq(0);

        const t = await c.multiply(x1, y1, 0);
        expect(t[0]).eq(0);
        expect(t[1]).eq(0);

        // Then multiply by N-1, then add the point again
        const pknm1 = pk.mul(secp256r1.n!.sub(new BN(1)));
        const x2 = bn2u256(pknm1.getX());
        const y2 = bn2u256(pknm1.getY());
        const blah = await c.add(x1, y1, x2, y2);
        expect(blah.x3).eq(0);
        expect(blah.y3).eq(0);
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
            const secretBytes = getRandomValues(new Uint8Array(32));
            const secret = new BN(secretBytes).mod(secp256r1.n!);
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

        constructor(sig: {r: bigint, s: bigint})
        {
            this.r = new BN(sig.r.toString(16), 16),
            this.s = new BN(sig.s.toString(16), 16),
            this.recoveryParam = null;
        }

        toDER(): number[];
        toDER(enc: "hex"): string;
        toDER(): string|number[] {
            throw new Error("toDER: not implemented!");
        }
    }

    it('EcDSA (Precompile)', async () => {
        for( let i = 0; i < 10; i++ )
        {
            const msgBytes = getRandomValues(new Uint8Array(32));
            const msg = new BN(msgBytes);
            const kp = secp256r1.genKeyPair();

            const secret = bn2u256(kp.getPrivate());
            const pk = {
                x: bn2u256(kp.getPublic().getX()),
                y: bn2u256(kp.getPublic().getY())
            };

            // Sign using the precompile
            const solsig = await c.ecdsa_sign_raw_precompile(secret, bn2u256(msg));

            // Verify Solidity signature in JS
            const jsressol = secp256r1.verify(msg, new SolSignature(solsig), kp);
            expect(jsressol).eq(true);

            // Verify Solidity signature in Solidity
            const ressol = await c.ecdsa_verify_raw(pk, bn2u256(msg), solsig.r, solsig.s);
            expect(ressol).eq(true);

            // Verify JS signature in Solidity (without doing encoding)
            const sigjs = secp256r1.sign(msg, kp);
            const sigder = '0x' + sigjs.toDER('hex');
            const publicCompressed = '0x' + kp.getPublic().encodeCompressed('hex');
            const resjs1 = await c.ecdsa_verify_raw_precompile_raw(publicCompressed, bn2u256(msg), sigder);
            expect(resjs1).eq(true);

            // Verify Solidity implementation of encoding matches
            const encoding = await c.ecdsa_test_encode([pk.x, pk.y], bn2u256(sigjs.r), bn2u256(sigjs.s));
            expect(publicCompressed).eq(encoding.pkb);
            expect(sigder).eq(encoding.sig);

            // Verify JS signature in Solidity (while doing encoding)
            const resjs = await c.ecdsa_verify_raw_precompile([pk.x, pk.y], bn2u256(msg), bn2u256(sigjs.r), bn2u256(sigjs.s));
            expect(resjs).eq(true);
        }
    });
})