import {FunctionComponent, JSX} from "preact";
import {useMemo, useState} from "preact/hooks";
import classes from "./index.module.css";
import {Button} from "../Button";
import {Message, MessageType} from "../Message";
import {RegexUtils} from "../../utils/regex.utils";
import {useWebAuthN} from "../../providers/WebAuthNProvider";

export enum UsernameFormType {
  LOGIN = 'login',
  REGISTER = 'register'
}

enum UsernameFormInternalStates {
  REGISTERING = 'registering'
}

interface Props {
  type: UsernameFormType
}

interface UsernameFormLabels {
  header: string;
  inputPlaceholder?: string;
  submitLabel?: string;
}

const labelsMap = {
  [UsernameFormType.LOGIN]: {
    header: 'Sign in',
    inputPlaceholder: 'Enter a username',
    submitLabel: 'Login'
  },
  [UsernameFormType.REGISTER]: {
    header: 'Create user',
    inputPlaceholder: 'Enter a username',
    submitLabel: 'Register'
  },
  [UsernameFormInternalStates.REGISTERING]: {
    header: 'Registering',
  }
}

export const UsernameForm: FunctionComponent<Props> = ({type}) => {
  const {register} = useWebAuthN();

  const {header, inputPlaceholder, submitLabel}: UsernameFormLabels = labelsMap[type];

  const [state, setState] = useState<UsernameFormType | UsernameFormInternalStates>(type);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const showForm = [UsernameFormType.LOGIN, UsernameFormType.REGISTER].includes(state as UsernameFormType);

  const [username, setUsername] = useState('')
  const [status, setStatus] = useState<{ type: MessageType, value: string }>({
    type: 'success',
    value: ''
  });

  const isValidForm = useMemo(() => {
    if (!username) {
      setStatus({
        type: 'error',
        value: 'Username is required!'
      })

      return false;
    }

    if (!RegexUtils.USERNAME_REGEX.test(username)) {
      setStatus({
        type: 'error',
        value: 'Username has invalid format!'
      })

      return false;
    }

    return true;
  }, [username])

  const handleInputChange = (e: JSX.TargetedEvent<HTMLInputElement, MouseEvent>) => {
    if (e.target instanceof HTMLInputElement) {
      setUsername(e.target.value);
    }
  }

  const handleFormSubmit = async (e: JSX.TargetedEvent<HTMLFormElement, SubmitEvent>) => {
    e.preventDefault();

    if (!isDirty) {
      setIsDirty(true);
    }

    if (!isValidForm) {
      return;
    }

    try {
      setStatus({
        type: 'info',
        value: 'Please wait...'
      })

      // TODO: Async validate if username is already taken - @returns false in case username is taken
      const tx = await register(username.toLowerCase());
      console.log('tx', tx);

      setStatus({
        type: 'success',
        value: 'Registered successfully!'
      })
    } catch (ex) {
      console.error(ex);

      setStatus({
        type: 'error',
        value: 'Something went wrong'
      })
    } finally {
      setState(type);
    }
  }

  return <div class={classes.usernameForm}>
    <div class={classes.header}>
      <img src="/fingerprint.svg" alt="Authenticate"/>
      <h2>{header}</h2>
    </div>
    {showForm && (<div>
      <form class={classes.form} onSubmit={handleFormSubmit} novalidate>
        <div>
          <input type="text" placeholder={inputPlaceholder} value={username} onInput={handleInputChange}/>
          {isDirty && (<Message type={status.type}>
            {status.value}
          </Message>)}
        </div>

        <Button type="submit" fullWidth>{submitLabel}</Button>
      </form>
    </div>)}
  </div>;
};
