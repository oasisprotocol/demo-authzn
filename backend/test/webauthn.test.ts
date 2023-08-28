import { expect } from "chai";
import { getBytes, hexlify } from "ethers";
import { ethers } from "hardhat";
import { TestWebAuthN } from "../typechain-types";
import { decodeAuthenticatorData } from "../src/webauthn";

describe('WebAuthN', () => {
    let contract : TestWebAuthN;
    before(async () => {
        const factory = await ethers.getContractFactory('TestWebAuthN');
        contract = await factory.deploy();
    });

    // Verify Solidity & TS implementations of AuthenticatorData parsing match
    it('Parse AuthenticatorData', async () => {
        const ad = '0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d9763410000171100000000000000000000000000000000006068a802ff82e40212f39537b806830dee2a8d941505f1936ab28cc6e9d5f00ded91ca936e5148be3ffbdee1d120fc029a36ed27ad8e7903e0733f964a0be69b989fb992087acd0deab9eeee61babb60dcbd66c935d266e90e7f294b130570ed61a5010203262001215820f550c2e7ec5767e33d4d34a2bcea2ca5fed921c9ff2b845148adb8cfff375418225820d9f0df021c3c606687e56ee0ccb0e3bf3fbebdd9614e54095e728625967236b7';

        const result = await contract.testParseAuthData(ad);

        const adBytes = getBytes(ad);
        const adResult = decodeAuthenticatorData(adBytes);
        console.log(adResult);

        expect(hexlify(adResult.rpIdHash)).eq(result.rpIdHash);
        expect(adResult.signCount).eq(result.signCount);
        expect(adResult.flags.UP).eq(result.flags.UP);
        expect(adResult.flags.UV).eq(result.flags.UV);
        expect(adResult.flags.BE).eq(result.flags.BE);
        expect(adResult.flags.BS).eq(result.flags.BS);
        expect(adResult.flags.AT).eq(result.flags.AT);
        expect(adResult.flags.ED).eq(result.flags.ED);
        expect(hexlify(adResult.attestedCredentialData!.aaguid)).eq(result.attestedCredentialData.aaguid);
        expect(hexlify(adResult.attestedCredentialData!.credentialId)).eq(result.attestedCredentialData.credentialId);
    });
});