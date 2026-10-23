import { createBrowserRouter } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import MainLayout from "../components/layout/MainLayout";
import RequireRole from "../components/common/RequireRole";
import DashboardPage from "../pages/DashboardPage";
import InventoryPage from "../pages/InventoryPage";
import NewSalePage from "../pages/NewSalePage";
import SalesPage from "../pages/SalesPage";       // ✅ AGREGADO: Faltaba este import
import GastosPage from "../pages/GastosPage";     // ✅ AGREGADO: Ya lo tenías, pero ahora sí se usa
import ReportsPage from "../pages/ReportsPage";
import UsersPage from "../pages/UsersPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        path: "dashboard",
        element: <MainLayout />,
        children: [
          // 🛡️ Rutas solo para admin
          { 
            index: true, 
            element: (
              <RequireRole roles={["admin"]}>
                <DashboardPage />
              </RequireRole>
            ) 
          },
          { 
            path: "inventario", 
            element: (
              <RequireRole roles={["admin"]}>
                <InventoryPage />
              </RequireRole>
            ) 
          },
          { 
            path: "reportes", 
            element: (
              <RequireRole roles={["admin"]}>
                <ReportsPage />
              </RequireRole>
            ) 
          },
          { 
            path: "usuarios", 
            element: (
              <RequireRole roles={["admin"]}>
                <UsersPage />
              </RequireRole>
            ) 
          },
          
          // 🛡️ Rutas para ambos roles (admin y vendedor)
          { 
            path: "ventas", 
            element: (
              <RequireRole>
                <SalesPage />
              </RequireRole>
            ) 
          },
          { 
            path: "gastos", // ✅ AGREGADO: La nueva página de Gastos
            element: (
              <RequireRole>
                <GastosPage />
              </RequireRole>
            ) 
          },
          { 
            path: "ventas/nueva", 
            element: (
              <RequireRole>
                <NewSalePage />
              </RequireRole>
            ) 
          },
        ],
      },
    ],
  },
]);