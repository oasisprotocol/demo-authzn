import { TestP256R1 } from "../typechain-types";
import { ethers } from "hardhat"
import { ec, curve } from "elliptic";
import crypto from 'crypto';
import { expect } from "chai";
import { bufToBigint, bufToHex } from 'bigint-conversion'
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
        await ll.deployed();

        const f = await ethers.getContractFactory('TestP256R1', {libraries: {SECP256R1: ll.address}});
        c = await f.deploy()
        await c.deployed();
    });

    // TODO: check anamolous curve points?

    it('Addition', async () => {
        for( let i = 0; i < 10; i++ ) {
            const kp1 = secp256r1.genKeyPair().getPublic();
            const x1 = '0x' + kp1.getX().toString('hex');
            const y1 = '0x' + kp1.getY().toString('hex');

            const kp2 = secp256r1.genKeyPair().getPublic();
            const x2 = '0x' + kp2.getX().toString('hex');
            const y2 = '0x' + kp2.getY().toString('hex');

            const kp3 = kp1.add(kp2);
            const x3 = '0x' + kp3.getX().toString('hex');
            const y3 = '0x' + kp3.getY().toString('hex');

            const z = await c.add(x1, y1, x2, y2);
            expect(z.x3).equal(x3);
            expect(z.y3).equal(y3);
        }
    });

    it('Doubling', async () => {
        for( let i = 0; i < 10; i++ ) {
            const kp1 = secp256r1.genKeyPair().getPublic();
            const x1 = '0x' + kp1.getX().toString('hex');
            const y1 = '0x' + kp1.getY().toString('hex');

            const kp2 = kp1.dbl();
            const x2 = '0x' + kp2.getX().toString('hex');
            const y2 = '0x' + kp2.getY().toString('hex');

            const z = await c.double(x1, y1);
            expect(z.x2).equal(x2);
            expect(z.y2).equal(y2);
        }
    });

    it('Multiply', async () => {
        for( let i = 1; i < 20; i++ ) {
            const kp1 = secp256r1.genKeyPair().getPublic();

            const x1 = '0x' + kp1.getX().toString('hex').padStart(64, '0');
            const y1 = '0x' + kp1.getY().toString('hex').padStart(64, '0');
            const secret = new BN(bufToHex(crypto.getRandomValues(new Uint8Array(32))), 16).mod(secp256r1.n!);
            const kp2 = kp1.mul(secret);

            const sbn = '0x'+secret.toString('hex');

            const x2 = '0x' + kp2.getX().toString('hex').padStart(64, '0');
            const y2 = '0x' + kp2.getY().toString('hex').padStart(64, '0');
            const kp3 = await c.multiply(x1, y1, sbn);

            expect(x2).eq(kp3[0]);
            expect(y2).eq(kp3[1]);
        }
    });

    // Used to wrap
    class SolSignature {
        r: BN;
        s: BN;
        recoveryParam: number | null;

        constructor(r: BN, s: BN)
        {
            this.r = r;
            this.s = s;
            this.recoveryParam = null;
        }

        toDER(): number[];
        toDER(enc: "hex"): string;
        toDER(enc?: "hex"): string|number[] {
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

            const x = new SolSignature(
                new BN(solsig.r.toHexString().slice(2), 16),
                new BN(solsig.s.toHexString().slice(2), 16));

            // Verify Solidity signature in JS
            const jsressol = secp256r1.verify(msg, x, kp);
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