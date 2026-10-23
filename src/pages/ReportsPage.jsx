import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/Print";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import emailjs from "@emailjs/browser";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY,
  REPORTE_EMAIL,
  METODOS_PAGO_LABELS,
  nombreSede,
} from "../config";
import { useSede } from "../context/SedeContext";
import Animate from "../components/common/Animate";

const cop = (n) => "$" + Number(n).toLocaleString("es-CO");
const fmtFecha = (iso) =>
  new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const pagosDe = (v) => v.pagos || [{ metodo: "efectivo", monto: v.total }];

const ETIQUETAS_PERIODO = {
  hoy: "Hoy",
  "7d": "7 días",
  mes: "Mes",
  todo: "Todo",
};

const ReportsPage = () => {
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
  const [periodo, setPeriodo] = useState("hoy");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [vendedorAbierto, setVendedorAbierto] = useState(null);
  const [ventaAbierta, setVentaAbierta] = useState(null);

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
    if (periodo === "hoy") desde = inicioHoy;
    if (periodo === "7d") desde = inicioHoy - 6 * 86400000;
    if (periodo === "mes") desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    return ventas.filter((v) => {
      const enRango = new Date(v.fecha).getTime() >= desde;
      const enSede = v.sede === sedeActiva;
      return enRango && enSede;
    });
  }, [ventas, periodo, sedeActiva]);

  const gastosFiltrados = useMemo(() => {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    let desde = 0;
    if (periodo === "hoy") desde = inicioHoy;
    if (periodo === "7d") desde = inicioHoy - 6 * 86400000;
    if (periodo === "mes") desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    return gastos.filter((g) => {
      const enRango = new Date(g.fecha).getTime() >= desde;
      const enSede = g.sede === sedeActiva;
      return enRango && enSede;
    });
  }, [gastos, periodo, sedeActiva]);

  // Total movido (ventas + gastos) para la tarjeta grande
  const totalVentas = ventasFiltradas.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const totalGastos = gastosFiltrados.reduce((s, g) => s + (Number(g.monto) || 0), 0);
  const totalMovido = totalVentas + totalGastos;

  // Agrupar por vendedor (solo para mostrar sus ventas)
  const porVendedor = useMemo(() => {
    const mapa = {};

    ventasFiltradas.forEach((v) => {
      const nombre = v.vendedorNombre || "Sin nombre";
      if (!mapa[nombre]) mapa[nombre] = { nombre, ventas: [], total: 0 };
      mapa[nombre].ventas.push(v);
      mapa[nombre].total += Number(v.total) || 0;
    });

    const lista = Object.values(mapa).sort((a, b) => b.total - a.total);
    return esAdmin ? lista : lista.filter((p) => p.nombre === user?.displayName);
  }, [ventasFiltradas, esAdmin, user]);

  const enviarPorCorreo = async () => {
    setMensaje(null);
    setEnviando(true);
    try {
      const porVendedorTexto =
        porVendedor
          .map((v) => `• ${v.nombre}: ${cop(v.total)} (${v.ventas.length} ventas)`)
          .join("\n") || "Sin movimientos en el periodo.";

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          para: REPORTE_EMAIL,
          periodo: ETIQUETAS_PERIODO[periodo],
          fecha_envio: new Date().toLocaleString("es-CO"),
          enviado_por: user?.displayName || user?.email || "Vendedor",
          total: cop(totalMovido),
          por_vendedor: porVendedorTexto,
          bajo_stock: "Ver Dashboard · Alertas de stock",
        },
        EMAILJS_PUBLIC_KEY
      );

      setMensaje({
        tipo: "success",
        texto: `Reporte enviado a jefatura ✔️ (${new Date().toLocaleTimeString("es-CO")})`,
      });
    } catch (e) {
      console.error("Error enviando reporte:", e);
      setMensaje({
        tipo: "error",
        texto: "No se pudo enviar el correo. Revisa los IDs de EmailJS en config.js.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Animate>
      <Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>Reportes</Typography>
            <Typography variant="body2" color="text.secondary">
              Detalle de ventas por vendedor · {nombreSede(sedeActiva)} · {ETIQUETAS_PERIODO[periodo]}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={periodo}
              onChange={(e, v) => v && setPeriodo(v)}
            >
              {Object.entries(ETIQUETAS_PERIODO).map(([k, label]) => (
                <ToggleButton key={k} value={k}>{label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
              Imprimir
            </Button>
            {!esAdmin && (
              <Button
                variant="contained"
                startIcon={<MailOutlineIcon />}
                onClick={enviarPorCorreo}
                disabled={enviando}
                sx={{ backgroundColor: "black" }}
              >
                {enviando ? "Enviando..." : "Enviar por correo"}
              </Button>
            )}
          </Box>
        </Box>

        {mensaje && <Alert severity={mensaje.tipo} sx={{ mb: 2 }}>{mensaje.texto}</Alert>}

        {/* TARJETA GRANDE: TOTAL MOVIDO */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 3, bgcolor: "primary.light" }}>
              <Typography variant="body2" color="primary.dark" fontWeight={600}>
                TOTAL MOVIDO
              </Typography>
              <Typography variant="h4" fontWeight={700} color="primary.dark">
                {cop(totalMovido)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 3 }}>
              <Typography color="text.secondary">Ventas</Typography>
              <Typography variant="h5" fontWeight={700}>{cop(totalVentas)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {ventasFiltradas.length} transacciones
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 3 }}>
              <Typography color="text.secondary">Gastos y pagos</Typography>
              <Typography variant="h5" fontWeight={700}>{cop(totalGastos)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {gastosFiltrados.length} registros
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* TARJETAS POR VENDEDOR CON DRILL-DOWN DE PRODUCTOS */}
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          {esAdmin ? "Ventas por vendedor" : "Mis ventas"}
        </Typography>
        {porVendedor.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Sin ventas en el periodo seleccionado.
            </Typography>
          </Paper>
        ) : (
          porVendedor.map((v) => (
            <Paper key={v.nombre} sx={{ mb: 2, overflow: "hidden" }}>
              <Box
                sx={{
                  p: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
                onClick={() => setVendedorAbierto(vendedorAbierto === v.nombre ? null : v.nombre)}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>{v.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {v.ventas.length} venta{v.ventas.length === 1 ? "" : "s"} · {ETIQUETAS_PERIODO[periodo]}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography variant="h6" fontWeight={700} color="primary">{cop(v.total)}</Typography>
                  <IconButton size="small">
                    {vendedorAbierto === v.nombre ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                </Box>
              </Box>

              <Collapse in={vendedorAbierto === v.nombre} timeout="auto" unmountOnExit>
                <Box sx={{ p: 2, bgcolor: "action.hover", borderTop: "1px solid", borderColor: "divider" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell />
                        <TableCell><b>Fecha</b></TableCell>
                        <TableCell><b>Sede</b></TableCell>
                        <TableCell><b>Pagos</b></TableCell>
                        <TableCell align="right"><b>Total</b></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...v.ventas]
                        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                        .map((venta) => (
                          <React.Fragment key={venta.id}>
                            <TableRow hover>
                              <TableCell padding="checkbox">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVentaAbierta(ventaAbierta === venta.id ? null : venta.id);
                                  }}
                                >
                                  {ventaAbierta === venta.id ? (
                                    <KeyboardArrowUpIcon />
                                  ) : (
                                    <KeyboardArrowDownIcon />
                                  )}
                                </IconButton>
                              </TableCell>
                              <TableCell>{fmtFecha(venta.fecha)}</TableCell>
                              <TableCell>
                                <Chip size="small" label={nombreSede(venta.sede || "sede1")} />
                              </TableCell>
                              <TableCell>
                                {pagosDe(venta).map((p) => METODOS_PAGO_LABELS[p.metodo] || p.metodo).join(" + ")}
                              </TableCell>
                              <TableCell align="right"><b>{cop(venta.total)}</b></TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                                <Collapse in={ventaAbierta === venta.id} timeout="auto" unmountOnExit>
                                  <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 2, mb: 1 }}>
                                    <Typography variant="subtitle2" fontWeight={700}>
                                      Productos vendidos
                                    </Typography>
                                    <Table size="small">
                                      <TableBody>
                                        {(venta.items || []).map((i, k) => (
                                          <TableRow key={k}>
                                            <TableCell>{i.nombre}</TableCell>
                                            <TableCell align="right">{i.cantidad} × {cop(i.precio)}</TableCell>
                                            <TableCell align="right">{cop(i.cantidad * i.precio)}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                    <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>
                                      Pago
                                    </Typography>
                                    {pagosDe(venta).map((p, k) => (
                                      <Typography key={k} variant="body2">
                                        • {METODOS_PAGO_LABELS[p.metodo] || p.metodo}: {cop(p.monto)}
                                        {p.referencia ? ` — ref: ${p.referencia}` : ""}
                                      </Typography>
                                    ))}
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))}
                    </TableBody>
                  </Table>
                </Box>
              </Collapse>
            </Paper>
          ))
        )}
      </Box>
    </Animate>
  );
};

export default ReportsPage;