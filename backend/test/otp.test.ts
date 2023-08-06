import { expect } from 'chai';
import { createHmac, randomBytes } from 'crypto';
import { ethers } from "hardhat";

import { HOTP_generate, TOTP_generate } from "../src/otp";
import { TestOTPSHA256, TestOTPSHA1 } from '../typechain-types';

function randU32() {
  return randomBytes(4).readUInt32BE(0);
}

describe('OTP', function () {
    let otpsha256: TestOTPSHA256;
    let otpsha1: TestOTPSHA1;
    before(async()=>{
        const OTPSHA256_Contract = await ethers.getContractFactory("TestOTPSHA256");
        otpsha256 = await OTPSHA256_Contract.deploy();

        const OTPSHA1_Contract = await ethers.getContractFactory("TestOTPSHA1");
        otpsha1 = await OTPSHA1_Contract.deploy();
    })

    async function testHMAC (algorithm:string, contract:TestOTPSHA256|TestOTPSHA1)
    {
      for( let i = 1; i < 128; i += 4 )
      {
          const key = randomBytes(i);
          const message = randomBytes(i);
          const hmac = createHmac(algorithm, Buffer.isBuffer(key) ? key : Buffer.from(key));
          const local_result = '0x' + hmac.update(message).digest('hex');
          const result = await contract.HMAC(key, message);
          expect(result).to.equal(local_result);
      }
    }

    async function testHOTP(algorithm:string, contract:TestOTPSHA256|TestOTPSHA1)
    {
      for( let i = 1; i < 128; i += 4 )
      {
          const counter = randU32();
          const key = randomBytes(i);
          const local_result = HOTP_generate({key, algorithm, counter});
          const result = await otpsha256.HOTP(key, counter);
          expect(result.toString().padStart(6, '0')).to.be.equal(local_result);
      }
    }

    async function testTOTP (algorithm:string, contract:TestOTPSHA256|TestOTPSHA1) {
      for( let i = 1; i < 128; i += 4 )
      {
        const when = randU32();
        const key = randomBytes(i);
        const time = randU32() % 0xFFF;
        const local_result = TOTP_generate({key, algorithm, time, when});
        const result = await contract.TOTP(key, time, when);
        expect(result.toString().padStart(6, '0')).to.be.equal(local_result);
      }
    }

    it("HMAC JS/contract match (SHA-256)", async function ()
    {
      await testHMAC('sha256', otpsha256);
    });

    it("HOTP JS/contract match (SHA-256)", async function () {
      testHOTP('sha256', otpsha256);
    });

    it("TOTP JS/contract match (SHA-256)", async function () {
      await testTOTP('sha256', otpsha256);
    });

    it("HMAC JS/contract match (SHA-1)", async function ()
    {
      await testHMAC('sha1', otpsha1);
    });

    it("HOTP JS/contract match (SHA-1)", async function () {
      testHOTP('sha1', otpsha1);
    });

    it("TOTP JS/contract match (SHA-1)", async function () {
      await testTOTP('sha1', otpsha1);
  });
});
