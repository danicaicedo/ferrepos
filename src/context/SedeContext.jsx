import { createContext, useContext, useState } from "react";

const SedeContext = createContext(null);

export const SedeProvider = ({ children }) => {
  const [sedeActiva, setSedeActiva] = useState(
    () => localStorage.getItem("ferrepos_sede") || "sede1"
  );

  const cambiarSede = (id) => {
    setSedeActiva(id);
    localStorage.setItem("ferrepos_sede", id);
  };

  return (
    <SedeContext.Provider value={{ sedeActiva, cambiarSede }}>
      {children}
    </SedeContext.Provider>
  );
};

export const useSede = () => useContext(SedeContext);