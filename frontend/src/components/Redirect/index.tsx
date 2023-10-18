import {RoutableProps, route} from "preact-router";
import {FunctionComponent} from "preact";
import {useEffect} from "preact/hooks";

interface Props extends RoutableProps {
  to: string;
}

export const Redirect: FunctionComponent<Props> = (props: Props) => {
  const { to } = props;

  useEffect(() => {
    route(to, true);
  }, [to])

  return null;
};
