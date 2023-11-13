import {FunctionComponent} from "preact";
const src = new URL('/logo.svg', import.meta.url).href

export const Logo: FunctionComponent = () => (<img src={src} alt="Oasis network"/>)
