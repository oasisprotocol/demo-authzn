// SPDX-License-Identifier: MIT
/*
MIT License

Copyright (c) 2021 TAB_mk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */
// TOTP & HOTP functions borrowed from https://github.com/TABmk/2fa-hotp-totp

import { createHmac, timingSafeEqual } from 'crypto';
import { Buffer } from "node:buffer";

const DEFAULT_ALGORITHM = 'sha1';

/**
 * https://github.com/TABmk/2fa-hotp-totp/blob/b313eb21ad18f133028b8d5e67ca25c156c776a3/lib/hotp.ts#L9
 * https://datatracker.ietf.org/doc/html/rfc4226#section-5.1
 *
 * @param value 8-byte counter value, the moving factor
 * @return buffer
 */
const calcCounter = (value: number) => {
  // <Buffer 00 00 00 00 00 00 00 00>
  const buf = Buffer.alloc(8);

  buf.writeBigInt64BE(BigInt(value), 0);

  return buf;
};

/**
 * HOTP(K,C) = Truncate(HMAC-SHA-1(K,C))
 *
 * https://github.com/TABmk/2fa-hotp-totp/blob/b313eb21ad18f133028b8d5e67ca25c156c776a3/lib/hotp.ts#L28
 * https://datatracker.ietf.org/doc/html/rfc4226#section-5.2
 *
 * @param key       unique secret key for user
 * @param algorithm custom algorithm for crypto.createHmac. Default: sha256
 * @param counter   moving factor. Default: 0
 * @return 6 digit code as a string
 */
export const HOTP_generate = ({ key, algorithm = DEFAULT_ALGORITHM, counter = 0 }: {
  key: string | Buffer,
  algorithm?: string,
  counter?: number,
}) => {
  const hmac = createHmac(algorithm, Buffer.isBuffer(key) ? key : Buffer.from(key));

  const hmacUpdated = hmac.update(calcCounter(counter)).digest('hex');

  const hmacResult = Buffer.from(hmacUpdated, 'hex');

  // https://datatracker.ietf.org/doc/html/rfc4226#section-5.4
  // RFC 6238 allow to use SHA256/512, that's why offset is not hmacResult[19]
  // https://datatracker.ietf.org/doc/html/rfc6238#section-1.2
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const binCode = (hmacResult[offset] & 0x7f) << 24
    | (hmacResult[offset + 1] & 0xff) << 16
    | (hmacResult[offset + 2] & 0xff) << 8
    | (hmacResult[offset + 3] & 0xff);

  const code = String(binCode % 1e6);

  // length+1
  const codeLength = 7;

  return new Array(codeLength - code.length).join('0') + code;
};

/**
 * https://github.com/TABmk/2fa-hotp-totp/blob/b313eb21ad18f133028b8d5e67ca25c156c776a3/lib/hotp.ts#L66
 * https://datatracker.ietf.org/doc/html/rfc4226#section-7.2
 *
 * @param token     code, provided by user
 * @param key       unique secret key for user
 * @param algorithm custom algorithm for crypto.createHmac. Default: sha256
 * @param window    counter values window. Default: 1
 * @param counter   moving factor. Default: 0
 * @return null if nothing found or number between -window to +window if same code in steps found
 */
export const HOTP_validate = ({
  token,
  key,
  algorithm = DEFAULT_ALGORITHM,
  window = 1,
  counter = 0,
}: {
  token: string,
  key: string | Buffer,
  algorithm?: string,
  window?: number,
  counter?: number,
}): number | null => {
  let redefCounter = counter;
  // eslint-disable-next-line
  for (let i = counter - window; i <= counter + window; ++i) {
    redefCounter = i;

    const generateToken = HOTP_generate({ key, algorithm, counter: redefCounter });

    if (Buffer.byteLength(token) === Buffer.byteLength(generateToken) && timingSafeEqual(Buffer.from(token), Buffer.from(generateToken))) {
      return i - counter;
    }
  }

  return null;
};

/**
 * TOTP = HOTP(K, T)
 *
 * https://github.com/TABmk/2fa-hotp-totp/blob/b313eb21ad18f133028b8d5e67ca25c156c776a3/lib/totp.ts#L13
 * https://datatracker.ietf.org/doc/html/rfc6238#section-4.2
 *
 * @param key  unique secret key for user
 * @param algorithm custom algorithm for crypto.createHmac. Default: sha256
 * @param time time-step in seconds (default recomended). Default: 30
 * @param when UTC time to generate challenge for, Default: current time
 * @return 6 digit code as a string
 */
export const TOTP_generate = ({
    key,
    algorithm = DEFAULT_ALGORITHM,
    time = 30,
    when = undefined
}: {
    key: string | Buffer,
    algorithm?: string,
    time?: number,
    when?: number
}) => HOTP_generate({
    key,
    algorithm,
    counter: Math.floor((when ? when : (Date.now() / 1000)) / time),
});

/**
 * https://github.com/TABmk/2fa-hotp-totp/blob/b313eb21ad18f133028b8d5e67ca25c156c776a3/lib/totp.ts#L33
 * https://datatracker.ietf.org/doc/html/rfc6238#section-5.2
 *
 * @param token  code, provided by user
 * @param key    unique secret key for user
 * @param algorithm custom algorithm for crypto.createHmac. Default: sha256
 * @param window counter values window. Default: 1
 * @param time   time-step in seconds (default is recomended). Default: 30
 * @return null if nothing found or number between -window to +window if same code in steps found
 */
export const TOTP_validate = ({
    token,
    key,
    algorithm = DEFAULT_ALGORITHM,
    window = 1,
    time = 30,
    when = undefined
}: {
    token: string,
    key: string | Buffer,
    algorithm?: string,
    window?: number,
    time?: number,
    when?: number
}): number | null => HOTP_validate({
    token,
    key,
    algorithm,
    window,
    counter: Math.floor((when ? when : (Date.now() / 1000)) / time),
});
