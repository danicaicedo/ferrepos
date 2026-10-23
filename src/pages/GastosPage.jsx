import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { nombreSede } from "../config";
import { useSede } from "../context/SedeContext";
import Animate from "../components/common/Animate";

const cop = (n) => `$${(Number(n) || 0).toLocaleString("es-CO")}`;
const fmtHora = (iso) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

const GastosPage = () => {
  const { sedeActiva } = useSede();
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const [gastos, setGastos] = useState([]);
  
  // Estados formulario Gasto
  const [descGasto, setDescGasto] = useState("");
  const [montoGasto, setMontoGasto] = useState("");
  
  // Estados formulario Pago
  const [nombrePago, setNombrePago] = useState(user?.displayName || "");
  const [montoPago, setMontoPago] = useState("");
  
  const [snack, setSnack] = useState({ open: false, msg: "", error: false });

  // Escuchar solo los gastos de HOY y de la SEDE ACTIVA
  useEffect(() => {
    const inicioHoy = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const q = query(
      collection(db, "gastos"),
      where("sede", "==", sedeActiva),
      where("fecha", ">=", inicioHoy),
      orderBy("fecha", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setGastos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [sedeActiva]);

  const agregarGasto = async () => {
    const monto = Number(montoGasto);
    if (!descGasto.trim() || !monto || monto <= 0) {
      return setSnack({ open: true, msg: "Revisa la descripción y el monto.", error: true });
    }
    try {
      await addDoc(collection(db, "gastos"), {
        tipo: "gasto",
        descripcion: descGasto.trim(),
        monto,
        usuario: user?.displayName || "Sin nombre",
        usuarioUid: user?.uid || "sin-uid", // ✅ ESTA LÍNEA ES OBLIGATORIA
        sede: sedeActiva,
        fecha: new Date().toISOString(),
      });
      setDescGasto("");
      setMontoGasto("");
      setSnack({ open: true, msg: "Gasto registrado.", error: false });
    } catch (e) {
      setSnack({ open: true, msg: "Error al guardar.", error: true });
    }
  };

const agregarPago = async () => {
    const monto = Number(montoPago);
    if (!nombrePago.trim() || !monto || monto <= 0) {
      return setSnack({ open: true, msg: "Revisa el nombre y el monto.", error: true });
    }
    try {
      await addDoc(collection(db, "gastos"), {
        tipo: "pago_trabajador",
        descripcion: nombrePago.trim(),
        monto,
        usuario: user?.displayName || "Sin nombre",
        usuarioUid: user?.uid || "sin-uid", // ✅ ESTA LÍNEA ES OBLIGATORIA
        sede: sedeActiva,
        fecha: new Date().toISOString(),
      });
      setNombrePago(user?.displayName || "");
      setMontoPago("");
      setSnack({ open: true, msg: "Pago registrado.", error: false });
    } catch (e) {
      setSnack({ open: true, msg: "Error al guardar.", error: true });
    }
  };

  const eliminar = async (id) => {
    if (window.confirm("¿Seguro que quieres borrar este registro?")) {
      await deleteDoc(doc(db, "gastos", id));
    }
  };

  const totalSacado = gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);

  return (
    <Animate>
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Gastos</Typography>
            <Typography variant="body2" color="text.secondary">
              Registro de salidas de caja · {nombreSede(sedeActiva)}
            </Typography>
          </Box>
          <Chip label={`Hoy: ${cop(totalSacado)}`} color="error" variant="outlined" sx={{ fontWeight: 700 }} />
        </Stack>

        {/* FORMULARIOS */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={1.5} color="primary">
                 Registrar Gasto
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  size="small"
                  label="¿En qué se gastó? (ej. Almuerzo, Taxi, Factura)"
                  value={descGasto}
                  onChange={(e) => setDescGasto(e.target.value)}
                  fullWidth
                />
                <TextField
                  size="small"
                  type="number"
                  label="Monto"
                  value={montoGasto}
                  onChange={(e) => setMontoGasto(e.target.value)}
                  fullWidth
                />
                <Button
                  variant="contained"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={agregarGasto}
                  disabled={!descGasto || !montoGasto}
                >
                  Agregar gasto
                </Button>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={1.5} color="secondary">
                👷 Pago a trabajador (diario)
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  size="small"
                  label="Nombre del trabajador"
                  value={nombrePago}
                  onChange={(e) => setNombrePago(e.target.value)}
                  fullWidth
                />
                <TextField
                  size="small"
                  type="number"
                  label="Monto a pagar"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  fullWidth
                />
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={agregarPago}
                  disabled={!nombrePago || !montoPago}
                >
                  Registrar pago
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* LISTA DEL DÍA */}
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell><b>Hora</b></TableCell>
                  <TableCell><b>Tipo</b></TableCell>
                  <TableCell><b>Descripción / Trabajador</b></TableCell>
                  <TableCell><b>Registrado por</b></TableCell>
                  <TableCell align="right"><b>Monto</b></TableCell>
                  <TableCell align="right"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gastos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No hay salidas de caja registradas hoy.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  gastos.map((g) => (
                    <TableRow key={g.id} hover>
                      <TableCell>{fmtHora(g.fecha)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={g.tipo === "gasto" ? "Gasto" : "Pago"}
                          color={g.tipo === "gasto" ? "warning" : "secondary"}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{g.descripcion}</TableCell>
                      <TableCell>{g.usuario}</TableCell>
                      <TableCell align="right"><b>{cop(g.monto)}</b></TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => eliminar(g.id)} color="error">
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {snack.open && (
          <Alert
            severity={snack.error ? "error" : "success"}
            sx={{ mt: 2 }}
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
          >
            {snack.msg}
          </Alert>
        )}
      </Box>
    </Animate>
  );
};

export default GastosPage;