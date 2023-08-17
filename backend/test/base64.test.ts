import { ethers } from "hardhat";
import { randomBytes } from "crypto";
import { TestBase64 } from "../typechain-types";
import { expect } from "chai";

describe('Base64', () => {
    let c : TestBase64;
    before(async () => {
        const f = await ethers.getContractFactory('TestBase64');
        c = await f.deploy();
        await c.waitForDeployment();
    });

    it('Encode', async () => {
        for( let i = 3; i < 128; i++ )
        {
            const b = randomBytes(i);
            const w = Buffer.from(b).toString('base64url');

            const x = await c.testEncode(b);
            expect(x).eq(w);
        }
    });
});
