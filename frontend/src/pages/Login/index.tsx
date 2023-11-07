import {RoutableProps} from "preact-router";
import {FunctionComponent} from "preact";
import {Layout} from "../../components/Layout";
import {UsernameForm, UsernameFormType} from "../../components/UsernameForm";

export const Login: FunctionComponent<RoutableProps> = () => {
  return (
    <Layout left={
      <>
        <h1>Welcome to Oasis Authenticator!</h1>
        <p>
          Oasis Authenticator is a login process for Web3 that verifies user identities with public keys instead of
          emails, text messages or other Web2 products.
        </p>
      </>
    } right={<UsernameForm type={UsernameFormType.LOGIN} />}/>
  );
};
