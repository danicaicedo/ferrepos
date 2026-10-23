import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSale";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLong";
import MoneyOffOutlinedIcon from "@mui/icons-material/MoneyOffOutlined"; // ✅ NUEVO
import AssessmentOutlinedIcon from "@mui/icons-material/Assessment";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { Box, Button, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Typography, colors } from "@mui/material";
import { images } from "../../assets";
import { useLocation, useNavigate } from "react-router-dom";
import Animate from "./Animate";

const Sidebar = ({ sidebarWidth }) => {
  const navigate = useNavigate();
  const location = useLocation();

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch (e) {}
  const esAdmin = user?.rol === "admin";

  const menus = esAdmin
    ? [
        { title: "Estadísticas", icon: <QueryStatsOutlinedIcon />, path: "/dashboard" },
        { title: "Inventario", icon: <Inventory2OutlinedIcon />, path: "/dashboard/inventario" },
      ]
    : [];

  const operationMenus = [
    { title: "Registrar venta", icon: <PointOfSaleOutlinedIcon />, path: "/dashboard/ventas/nueva" },
    { title: esAdmin ? "Ventas" : "Mis ventas", icon: <ReceiptLongOutlinedIcon />, path: "/dashboard/ventas" },
    { title: "Gastos", icon: <MoneyOffOutlinedIcon />, path: "/dashboard/gastos" }, // ✅ NUEVO
  ];

  const adminMenus = esAdmin
    ? [
        { title: "Reportes", icon: <AssessmentOutlinedIcon />, path: "/dashboard/reportes" },
        { title: "Usuarios", icon: <PeopleOutlinedIcon />, path: "/dashboard/usuarios" },
      ]
    : [];

  const MenuItem = (props) => {
    const isActive = location.pathname === props.item.path;
    return (
      <ListItem key={props.index} disableGutters disablePadding sx={{ py: 0.5 }}>
        <ListItemButton
          onClick={() => navigate(props.item.path)}
          sx={{
            borderRadius: "10px",
            bgcolor: isActive ? colors.green[600] : "",
            color: isActive ? colors.common.white : "",
            "&:hover": {
              bgcolor: isActive ? colors.green[600] : colors.green[50],
              color: isActive ? colors.common.white : "",
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: "40px", color: isActive ? colors.common.white : "" }}>
            {props.item.icon}
          </ListItemIcon>
          <ListItemText primary={<Typography fontWeight={600}>{props.item.title}</Typography>} />
        </ListItemButton>
      </ListItem>
    );
  };

  const cerrarSesion = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const drawer = (
    <Box padding={3} paddingBottom={0} display="flex" flexDirection="column" height="100vh"
      sx={{ "::-webkit-scrollbar": { display: "none" } }}
    >
      <Box sx={{ textAlign: "center", mb: 2 }}>
        <Animate type="fade" delay={1}>
          <img src={images.logo} alt="logo" height={260} />
        </Animate>
      </Box>

      <Animate sx={{ flexGrow: 1 }}>
        <Paper elevation={0} square sx={{
          borderTopRightRadius: "10px", borderTopLeftRadius: "10px", p: 2, height: "100%",
          boxShadow: "rgba(145, 158, 171, 0.2) 0px 0px 2px 0px, rgba(145, 158, 171, 0.12) 0px 12px 24px -4px"
        }}>
          <Typography variant="caption" color={colors.grey[600]} fontWeight={700}>
            {user?.displayName || "Sin sesión"} · {esAdmin ? "Administrador" : "Vendedor"}
          </Typography>

          {menus.length > 0 && (
            <List>
              {menus.map((item, index) => (
                <MenuItem key={index} item={item} index={index} />
              ))}
            </List>
          )}

          <List>
            <ListItem>
              <Typography fontWeight={600} mt={1} color={colors.grey[600]}>Operación</Typography>
            </ListItem>
            {operationMenus.map((item, index) => (
              <MenuItem key={index} item={item} index={index} />
            ))}
          </List>

          {adminMenus.length > 0 && (
            <List>
              <ListItem>
                <Typography fontWeight={600} mt={1} color={colors.grey[600]}>Administración</Typography>
              </ListItem>
              {adminMenus.map((item, index) => (
                <MenuItem key={index} item={item} index={index} />
              ))}
            </List>
          )}

          <Box sx={{ mt: 2, px: 1 }}>
            <Button
              fullWidth
              startIcon={<LogoutOutlinedIcon />}
              onClick={cerrarSesion}
              sx={{ justifyContent: "flex-start", textTransform: "none", color: colors.grey[700] }}
            >
              Cerrar sesión
            </Button>
          </Box>
        </Paper>
      </Animate>
    </Box>
  );

  return (
    <Box component="nav" sx={{ width: { md: sidebarWidth }, flexShrink: { md: 0 } }}>
      <Drawer variant="permanent" sx={{
        display: { xs: "none", sm: "none", md: "block" },
        "& .MuiDrawer-paper": {
          boxSizing: "border-box", width: sidebarWidth, borderWidth: 0,
          bgcolor: "transparent", "::-webkit-scrollbar": { display: "none" }
        }
      }} open>
        {drawer}
      </Drawer>
    </Box>
  );
};

export default Sidebar;