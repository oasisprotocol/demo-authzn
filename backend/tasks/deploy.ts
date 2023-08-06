import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("deploy", "Deploy contracts necessary for the frontend")
    .setAction(async (args, hre:HardhatRuntimeEnvironment) => {
        const curveFactory = await hre.ethers.getContractFactory("SECP256R1");
        const curveLibrary = await curveFactory.deploy();
        await curveLibrary.deployed();

        const contractFactory = await hre.ethers.getContractFactory("WebAuthNExample", {libraries: {SECP256R1: curveLibrary.address}});
        const contract = await contractFactory.deploy();
        await contract.deployed();

        const chainId = (await contract.provider.getNetwork()).chainId;
        console.log(`VITE_WEBAUTH_ADDR=${contract.address}`);
        console.log(`VITE_CHAIN_ID=${chainId}`);
    });
