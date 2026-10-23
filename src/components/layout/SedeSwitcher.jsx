import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import StorefrontOutlinedIcon from "@mui/icons-material/Storefront";
import { useSede } from "../../context/SedeContext";
import { SEDES, nombreSede } from "../../config";

const SedeSwitcher = () => {
  const { sedeActiva, cambiarSede } = useSede();
  const [anchorEl, setAnchorEl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Al iniciar sesión se marca "pendiente" y preguntamos la sede del turno
  useEffect(() => {
    if (sessionStorage.getItem("ferrepos_sede_pending")) {
      setDialogOpen(true);
    }
  }, []);

  const elegir = (id) => {
    cambiarSede(id);
    sessionStorage.removeItem("ferrepos_sede_pending");
    setDialogOpen(false);
  };

  return (
    <>
      <Chip
        icon={<StorefrontOutlinedIcon />}
        label={nombreSede(sedeActiva)}
        color="primary"
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ fontWeight: 700, cursor: "pointer" }}
      />
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {SEDES.map((s) => (
          <MenuItem
            key={s.id}
            selected={s.id === sedeActiva}
            onClick={() => {
              elegir(s.id);
              setAnchorEl(null);
            }}
          >
            {s.nombre}
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={dialogOpen} onClose={() => elegir(sedeActiva)}>
        <Box sx={{ p: 3, minWidth: 320 }}>
          <Typography variant="h6" fontWeight={700} mb={1}>
            ¿Dónde trabajas hoy?
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Elige la sede del turno. Puedes cambiarla cuando quieras desde el selector de la barra superior.
          </Typography>
          {SEDES.map((s) => (
            <Button
              key={s.id}
              fullWidth
              variant={s.id === sedeActiva ? "contained" : "outlined"}
              sx={{ mb: 1 }}
              onClick={() => elegir(s.id)}
            >
              {s.nombre}
            </Button>
          ))}
        </Box>
      </Dialog>
    </>
  );
};

export default SedeSwitcher;