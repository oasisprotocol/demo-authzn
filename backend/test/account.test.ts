import { expect } from "chai";
import { ethers } from "hardhat";
import { EventLog } from "ethers";

import { TestAccount, TestAccountTarget } from "../typechain-types";

describe('Account', () => {
    let contract : TestAccount;
    let target : TestAccountTarget;
    let cloneAddr : string;

    before(async () => {
        // Test Account factory
        let factory = await ethers.getContractFactory("TestAccount");
        contract = await factory.deploy();
        await contract.waitForDeployment();

        // Create target contract
        let factory2 = await ethers.getContractFactory('TestAccountTarget');
        target = await factory2.deploy();
        await target.waitForDeployment();

        // Create a cloned Account contact
        const ctx = await contract.testClone();
        const cr = await ctx.wait();

        // Emits cloned contract address
        expect(cr?.logs.length).eq(1);
        const cl = (cr?.logs[0] as EventLog);
        cloneAddr = cl.args[0];
        expect(cloneAddr.length == 42);
    });

    it('Account Staticcall Works', async () => {
        const acct = await ethers.getContractAt("Account", cloneAddr);
        const acctWithSigner = acct.connect((await ethers.getSigners())[0]);

        // Encode public view call
        const example = target.interface.encodeFunctionData('exampleView');
        const example_result = await acctWithSigner.staticcall(await target.getAddress(), example);

        // Decode staticcall result
        const result = target.interface.decodeFunctionResult("exampleView", example_result);
        expect(result[0]).equal(await acct.getAddress());
        expect(result[1]).equal(await target.getAddress());
    });
});
