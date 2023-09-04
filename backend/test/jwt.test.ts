import { ethers } from "hardhat";
import { expect } from "chai";
import { TestJWT } from "../typechain-types";

describe('JWT', () => {
    let contract : TestJWT;
    before(async () => {
        const jwtlib = await (await ethers.getContractFactory('JWT')).deploy();
        await jwtlib.waitForDeployment();

        const factory = await ethers.getContractFactory('TestJWT', {libraries: {JWT: await jwtlib.getAddress()}});
        contract = await factory.deploy();
        await contract.waitForDeployment();
    });
    it('HS256', async () => {
        const secret = new TextEncoder().encode('secret');
        const result = await contract.testHS256(secret, '{"some":"payload"}');
        expect(result).eq('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb21lIjoicGF5bG9hZCJ9.4twFt5NiznN84AWoo1d7KO1T_yoc0Z6XOpOVswacPZg');
    });
});
