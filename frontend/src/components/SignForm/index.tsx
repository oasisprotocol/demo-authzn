import {FunctionComponent, JSX} from "preact";
import {Button} from "../Button";
import {useEffect, useMemo, useRef, useState} from "preact/hooks";
import {WindowUtils} from "../../utils/window.utils";
import {useWebAuthN} from "../../providers/WebAuthNProvider";
import {TransactionLike} from "ethers";
import {Card} from "../Card";
import {InfoList} from "../InfoList";
import classes from "./index.module.css";
import {Message, MessageType} from "../Message";
import {RegexUtils} from "../../utils/regex.utils";

export const SignForm: FunctionComponent = () => {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<{ type: MessageType, value: string }>({
    type: 'success',
    value: ''
  });
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [unSignedTx, setUnSignedTx] = useState<Record<string, string>>({});
  const unSignedTxRef = useRef<TransactionLike | null>(null);
  const {sign} = useWebAuthN();

  const handleInputChange = (e: JSX.TargetedEvent<HTMLInputElement, MouseEvent>) => {
    if (e.target instanceof HTMLInputElement) {
      setUsername(e.target.value);
    }
  }

  useEffect(() => {
    const unSignedTxString = WindowUtils.getSearchParam('unSignedTx');
    const unSignedTx = JSON.parse(unSignedTxString);

    unSignedTxRef.current = unSignedTx;
    setUnSignedTx(unSignedTx);
  }, []);

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

  const handleFormSubmit = async (e: JSX.TargetedEvent<HTMLFormElement, SubmitEvent>) => {
    e.preventDefault();

    if (!isDirty) {
      setIsDirty(true);
    }

    if (!isValidForm) {
      return;
    }

    if (!isLoading) {
      setIsLoading(true);
    }

    setStatus({
      type: 'info',
      value: 'Please wait...'
    })

    try {
      const tx = await sign(username, unSignedTxRef.current!);
      WindowUtils.postMessageToOpener<{ tx: string }>({tx});
    } catch (ex) {
      console.error(ex);

      setStatus({
        type: 'error',
        value: 'Something went wrong'
      });

      setIsLoading(false);
    }
  }

  return <Card>
    <div className={classes.header}>
      <h2>Sign</h2>
    </div>
    <InfoList data={unSignedTx as any} />

    <div>
      <form className={classes.form} onSubmit={handleFormSubmit} noValidate>
        <div>
          <input type="text" placeholder="username" value={username} onInput={handleInputChange}/>
          {isDirty && (<Message type={status.type}>
            {status.value}
          </Message>)}
        </div>

        <Button type="submit" fullWidth disabled={isLoading}>Sign</Button>
      </form>
    </div>
  </Card>;
};
