import { ethers } from "hardhat";
import { TestMakeJSON } from "../typechain-types";
import { expect } from "chai";

type SimpleObject = { [id: string]: string | boolean };

enum ValueType {
    JSONString = 0,
    JSONBool = 1
}

/**
 * Object to token
 */
function object2makejson (o:SimpleObject)
{
    return Object.entries(o).map(([k, v]) => {
        if( typeof v == "boolean" ) {
            return {
                t: ValueType.JSONBool,
                k: k,
                v: v ? "true" : "false"
            };
        }
        if( typeof v == "string" ) {
            return {
                t: ValueType.JSONString,
                k: k,
                v: v
            };
        }
        throw new Error(`Incompatible value type! Key:${k} Value:${v}`);
    });
}

describe('MakeJSON', () => {
    let c : TestMakeJSON;
    before(async () => {
        const f = await ethers.getContractFactory('TestMakeJSON');
        c = await f.deploy();
        await c.waitForDeployment();
    });

    it('Serialize', async () => {
        const d = {
            'blah': true,
            'raah': 'dorp',
            'zaah': false,
            'dorp': 'raah'
        }
        const r = await c.testFrom(object2makejson(d));
        expect(r).eq(JSON.stringify(d));
    });
});
