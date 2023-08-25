import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("deploy", "Deploy contracts necessary for the frontend")
    .setAction(async (_, hre:HardhatRuntimeEnvironment) => {
        const curveFactory = await hre.ethers.getContractFactory("SECP256R1Precompile");
        const curveLibrary = await curveFactory.deploy();
        await curveLibrary.waitForDeployment();

        const contractFactory = await hre.ethers.getContractFactory("WebAuthNExample", {libraries: {SECP256R1Precompile: await curveLibrary.getAddress()}});
        const contract = await contractFactory.deploy();
        await contract.waitForDeployment();

        const chainId = (await contract.runner!.provider!.getNetwork()).chainId;
        console.log(`VITE_WEBAUTH_ADDR=${await contract.getAddress()}`);
        console.log(`VITE_SAPPHIRE_CHAIN_ID=0x${Number(chainId).toString(16)}`);
    });
