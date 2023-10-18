import {FunctionComponent} from "preact";

interface Props {
  color?: string;
}

export const ButtonArrow: FunctionComponent<Props> = ({ color = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="19" viewBox="0 0 10 19" fill="none">
    <path d="M1.29277 18L7.74596 11.0157C8.45401 10.2494 8.454 9.0675 7.74596 8.30117L1 1" stroke={color} strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round"/>
  </svg>
)
