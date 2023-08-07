# Sapphire Auth[ZN] Demo

This project demonstrates how to use WebAuthN credentials with Oasis Sapphire.
This allows users to use strong device-level authentication, such as TouchID,
YubiKey, Android biometric, Windows Hello etc.

Currently it only supports SEC P256 R1 credentials, and additional work will be
needed to adapt it to your specific use-case.

I have also included code for TOTP authentication.

TODO:

 * When verifying attestations in contract
   * Verify `clientDataJSON`
     * Use an application-specific protocol to determine the base64 encoded `challenge` parameter
   * Verify `authenticatorData` (which includes `rpIdHash`)
 * Support RSA and Ed25519?

## Building, Testing & Running

To build and test:

```shell
pnpm install
make
make -C backend test
```

Then to start a local Sapphire node, deploy the contracts and run web server:

```shell
make sapphire-dev &
make -C backend deploy-local
make -C frontend run
```

Steps to test:

 * Fill in `username` input
 * Click `Register` button
 * Click `Login` button

Testing without a WebAuthN compatible hardware key or supported device:

 * In Chrome DevTools, click the Kebab Menu button next to the cog (`⋮`)
 * Click 'More Tools'
 * Click 'WebAuthN'
 * Click 'Add' under 'New authenticator' (ctap2, usb)
