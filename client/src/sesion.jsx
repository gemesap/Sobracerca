import { createContext, useContext, useState } from 'react';
import { guardarSesion, sesion as leer } from './api.js';

const Ctx = createContext(null);
export function ProveedorSesion({ children }) {
  const [s, setS] = useState(leer());
  const entrar = (datos) => { guardarSesion(datos); setS(datos); };
  const salir = () => { guardarSesion(null); setS(null); };
  return <Ctx.Provider value={{ usuario: s?.usuario, entrar, salir }}>{children}</Ctx.Provider>;
}
export const useSesion = () => useContext(Ctx);
