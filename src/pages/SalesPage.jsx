import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { nombreSede } from "../config";
import { useSede } from "../context/SedeContext";
import Animate from "../components/common/Animate";

const cop = (n) => `$${(Number(n) || 0).toLocaleString("es-CO")}`;
const fmtFecha = (iso) =>
  new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const SalesPage = () => {
  const { sedeActiva } = useSede();
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);
  const esAdmin = user?.rol === "admin";

  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [filtro, setFiltro] = useState("hoy");
  const [personaAbierta, setPersonaAbierta] = useState(null);

  useEffect(() => {
    const unsubV = onSnapshot(collection(db, "sales"), (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubG = onSnapshot(collection(db, "gastos"), (snap) => {
      setGastos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubV();
      unsubG();
    };
  }, []);

  const ventasFiltradas = useMemo(() => {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    let desde = 0;
    if (filtro === "hoy") desde = inicioHoy;
    if (filtro === "7d") desde = inicioHoy - 6 * 86400000;
    return ventas.filter((v) => {
      const enRango = new Date(v.fecha).getTime() >= desde;
      const enSede = v.sede === sedeActiva;
      return enRango && enSede;
    });
  }, [ventas, filtro, sedeActiva]);

  const gastosFiltrados = useMemo(() => {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    let desde = 0;
    if (filtro === "hoy") desde = inicioHoy;
    if (filtro === "7d") desde = inicioHoy - 6 * 86400000;
    return gastos.filter((g) => {
      const enRango = new Date(g.fecha).getTime() >= desde;
      const enSede = g.sede === sedeActiva;
      return enRango && enSede;
    });
  }, [gastos, filtro, sedeActiva]);

  // ✅ AGRUPACIÓN POR NOMBRE con detalle de gastos/pagos
  const porPersona = useMemo(() => {
    const mapa = {};

    // Ventas
    ventasFiltradas.forEach((v) => {
      const nombre = v.vendedorNombre || "Sin nombre";
      if (!mapa[nombre]) mapa[nombre] = { nombre, efectivo: 0, transacciones: 0, gastos: [], pagos: [], ventas: [] };
      
      const pagos = v.pagos || [{ metodo: "efectivo", monto: v.total }];
      pagos.forEach((p) => {
        if (p.metodo === "efectivo") {
          mapa[nombre].efectivo += Number(p.monto) || 0;
        } else {
          mapa[nombre].transacciones += Number(p.monto) || 0;
        }
      });
      mapa[nombre].ventas.push(v);
    });

    // Gastos: ahora guardamos array con descripción
    gastosFiltrados.forEach((g) => {
      const nombre = g.usuario || "Sin nombre";
      if (!mapa[nombre]) mapa[nombre] = { nombre, efectivo: 0, transacciones: 0, gastos: [], pagos: [], ventas: [] };
      
      if (g.tipo === "gasto") {
        mapa[nombre].gastos.push({ descripcion: g.descripcion, monto: Number(g.monto) || 0 });
      } else if (g.tipo === "pago_trabajador") {
        mapa[nombre].pagos.push({ descripcion: g.descripcion, monto: Number(g.monto) || 0 });
      }
    });

    const lista = Object.values(mapa).map((p) => {
      const totalGastos = p.gastos.reduce((s, g) => s + g.monto, 0);
      const totalPagos = p.pagos.reduce((s, g) => s + g.monto, 0);
      return {
        ...p,
        totalGastos,
        totalPagos,
        total: p.efectivo + p.transacciones + totalGastos + totalPagos,
      };
    });
    lista.sort((a, b) => b.total - a.total);

    return esAdmin ? lista : lista.filter((p) => p.nombre === user?.displayName);
  }, [ventasFiltradas, gastosFiltrados, esAdmin, user]);

  const etiquetaPeriodo =
    filtro === "hoy" ? "hoy" : filtro === "7d" ? "en los últimos 7 días" : "en todo el histórico";

  return (
    <Animate>
      <Box>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
          flexWrap="wrap"
          gap={2}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>Ventas</Typography>
            <Typography variant="body2" color="text.secondary">
              Resumen por persona · {nombreSede(sedeActiva)} · {etiquetaPeriodo}
            </Typography>
          </Box>
          <ButtonGroup size="small">
            <Button variant={filtro === "hoy" ? "contained" : "outlined"} onClick={() => setFiltro("hoy")}>
              HOY
            </Button>
            <Button variant={filtro === "7d" ? "contained" : "outlined"} onClick={() => setFiltro("7d")}>
              7 DÍAS
            </Button>
            <Button variant={filtro === "todo" ? "contained" : "outlined"} onClick={() => setFiltro("todo")}>
              TODO
            </Button>
          </ButtonGroup>
        </Stack>

        {porPersona.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              No hay movimientos {etiquetaPeriodo} en {nombreSede(sedeActiva)}. 
            </Typography>
          </Paper>
        ) : (
          porPersona.map((p) => (
            <Paper key={p.nombre} sx={{ mb: 2, overflow: "hidden" }}>
              <Box
                sx={{
                  p: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
                onClick={() => setPersonaAbierta(personaAbierta === p.nombre ? null : p.nombre)}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {esAdmin ? p.nombre : "Tú"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {p.ventas.length} venta{p.ventas.length === 1 ? "" : "s"} {etiquetaPeriodo}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography variant="h6" fontWeight={700} color="primary">
                    {cop(p.total)}
                  </Typography>
                  <IconButton size="small">
                    {personaAbierta === p.nombre ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                </Box>
              </Box>

              <Collapse in={personaAbierta === p.nombre} timeout="auto" unmountOnExit>
                <Box sx={{ p: 2, bgcolor: "action.hover", borderTop: "1px solid", borderColor: "divider" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: "background.paper" }}>
                        <TableCell><b>Concepto</b></TableCell>
                        <TableCell align="right"><b>Monto</b></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* GASTOS CON DETALLE */}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>🍽️ Gastos operativos</TableCell>
                        <TableCell align="right">{cop(p.totalGastos)}</TableCell>
                      </TableRow>
                      {p.gastos.map((g, idx) => (
                        <TableRow key={idx} sx={{ bgcolor: "background.paper" }}>
                          <TableCell sx={{ pl: 4, color: "text.secondary" }}>
                            ↳ {g.descripcion}
                          </TableCell>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>
                            {cop(g.monto)}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* PAGOS CON DETALLE */}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>👷 Pagos a trabajadores</TableCell>
                        <TableCell align="right">{cop(p.totalPagos)}</TableCell>
                      </TableRow>
                      {p.pagos.map((pg, idx) => (
                        <TableRow key={idx} sx={{ bgcolor: "background.paper" }}>
                          <TableCell sx={{ pl: 4, color: "text.secondary" }}>
                            ↳ {pg.descripcion}
                          </TableCell>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>
                            {cop(pg.monto)}
                          </TableCell>
                        </TableRow>
                      ))}

                      <TableRow>
                        <TableCell>📱 Transacciones (Nequi/Daviplata)</TableCell>
                        <TableCell align="right">{cop(p.transacciones)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>💵 Efectivo</TableCell>
                        <TableCell align="right">{cop(p.efectivo)}</TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: "primary.light", "& td": { fontWeight: 700 } }}>
                        <TableCell>TOTAL MOVIDO</TableCell>
                        <TableCell align="right">{cop(p.total)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {p.ventas.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" fontWeight={700} mb={1}>
                        Detalle de ventas
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><b>Fecha</b></TableCell>
                            <TableCell><b>Pagos</b></TableCell>
                            <TableCell align="right"><b>Total</b></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {p.ventas.map((v) => (
                            <TableRow key={v.id}>
                              <TableCell>{fmtFecha(v.fecha)}</TableCell>
                              <TableCell>
                                {(v.pagos || [{ metodo: "efectivo" }])
                                  .map((p) => p.metodo)
                                  .join(" + ")}
                              </TableCell>
                              <TableCell align="right">{cop(v.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Paper>
          ))
        )}
      </Box>
    </Animate>
  );
};

export default SalesPage;