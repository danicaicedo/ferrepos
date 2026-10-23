import { Navigate } from "react-router-dom";

const RequireRole = ({ roles, children }) => {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch (e) {}

  // 1. Si no hay nadie logueado, lo manda al login
  if (!user) return <Navigate to="/" replace />;

  // 2. Si la ruta exige ciertos roles y el usuario no lo tiene, lo manda a su inicio
  if (roles && roles.length > 0 && !roles.includes(user.rol)) {
    // Si es admin lo manda al dashboard, si es vendedor lo manda a registrar venta
    return <Navigate to={user.rol === "admin" ? "/dashboard" : "/dashboard/ventas/nueva"} replace />;
  }

  // 3. Si todo está bien, deja ver la página
  return children;
};

export default RequireRole;