import { useEffect, useState } from "react";
import {
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { nombreSede } from "../config";
import Animate from "../components/common/Animate";

const UsersPage = () => {
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  return (
    <Animate>
      <Box>
        <Typography variant="h5" fontWeight={700} mb={1}>Usuarios del sistema</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Personas registradas en FerrePOS (vendedores y jefatura)
        </Typography>
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><b>Nombre</b></TableCell>
                <TableCell><b>Correo</b></TableCell>
                <TableCell align="center"><b>Rol</b></TableCell>
                <TableCell align="center"><b>Sede</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                    Aún no hay usuarios registrados.
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      {u.displayName || u.nombre || (u.email || "").split("@")[0]}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={u.rol === "admin" ? "Admin" : "Vendedor"}
                        color={u.rol === "admin" ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {u.sede ? nombreSede(u.sede) : <Chip size="small" label="Sin asignar" variant="outlined" />}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Animate>
  );
};

export default UsersPage;