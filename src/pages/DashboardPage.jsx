import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  colors,
} from "@mui/material";
import AttachMoneyOutlinedIcon from "@mui/icons-material/AttachMoneyOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ShoppingBasketOutlinedIcon from "@mui/icons-material/ShoppingBasketOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { nombreSede, stockDe, SEDES } from "../config";
import { useSede } from "../context/SedeContext";
import Animate from "../components/common/Animate";

const cop = (n) => "$" + Number(n).toLocaleString("es-CO");

const ETIQUETAS_PERIODO = {
  hoy: "Hoy",
  "7d": "7 días",
  mes: "Mes",
  año: "Año",
};

const TITULO_CAMALEON = {
  hoy: "Vendido hoy",
  "7d": "Vendido en 7 días",
  mes: "Vendido en el mes",
  año: "Vendido en el año",
};

const StatCard = ({ icono, color, valor, titulo, detalle }) => (
  <Paper sx={{ p: 3, height: "100%", display: "flex", gap: 2, alignItems: "center" }}>
    <Box
      sx={{
        width: 48,
        height: 48,
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: `${color}1A`,
        color,
      }}
    >
      {icono}
    </Box>
    <Box>
      <Typography variant="h6" fontWeight={700}>{valor}</Typography>
      <Typography variant="body2" color="text.secondary">{titulo}</Typography>
      {detalle && <Typography variant="caption" color="text.secondary">{detalle}</Typography>}
    </Box>
  </Paper>
);

// Agrupa ventas por (etiqueta del eje, sede1, sede2) según el periodo
const agruparVentas = (ventas, periodo) => {
  const ahora = new Date();

  if (periodo === "hoy") {
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const horas = {};
    ventas.forEach((v) => {
      const fv = new Date(v.fecha);
      if (fv < inicioHoy) return;
      const clave = `${String(fv.getHours()).padStart(2, "0")}:00`;
      if (!horas[clave]) horas[clave] = { label: clave, orden: fv.getHours(), sede1: 0, sede2: 0 };
      if (v.sede === "sede1") horas[clave].sede1 += v.total || 0;
      else if (v.sede === "sede2") horas[clave].sede2 += v.total || 0;
    });
    return Object.values(horas).sort((a, b) => a.orden - b.orden);
  }

  if (periodo === "7d") {
    const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - i);
      const inicioDia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const finDia = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const ventasDia = ventas.filter((v) => {
        const fv = new Date(v.fecha);
        return fv >= inicioDia && fv <= finDia;
      });
      result.push({
        label: i === 0 ? "Hoy" : diasSemana[d.getDay()],
        orden: 6 - i,
        sede1: ventasDia.filter((v) => v.sede === "sede1").reduce((s, v) => s + (v.total || 0), 0),
        sede2: ventasDia.filter((v) => v.sede === "sede2").reduce((s, v) => s + (v.total || 0), 0),
      });
    }
    return result;
  }

  if (periodo === "mes") {
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const result = [];
    for (let i = 0; i < 5; i++) {
      const inicioSem = new Date(inicioMes.getTime() + i * 7 * 86400000);
      const finSem = new Date(inicioSem.getTime() + 7 * 86400000 - 1);
      const ventasSem = ventas.filter((v) => {
        const fv = new Date(v.fecha);
        return fv >= inicioSem && fv <= finSem && fv >= inicioMes;
      });
      const sede1 = ventasSem.filter((v) => v.sede === "sede1").reduce((s, v) => s + (v.total || 0), 0);
      const sede2 = ventasSem.filter((v) => v.sede === "sede2").reduce((s, v) => s + (v.total || 0), 0);
      if (sede1 === 0 && sede2 === 0 && i > 3) continue;
      result.push({ label: `Sem ${i + 1}`, orden: i, sede1, sede2 });
    }
    return result;
  }

  if (periodo === "año") {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const result = [];
    for (let m = 0; m <= ahora.getMonth(); m++) {
      const inicioMes = new Date(ahora.getFullYear(), m, 1);
      const finMes = new Date(ahora.getFullYear(), m + 1, 0, 23, 59, 59, 999);
      const ventasMes = ventas.filter((v) => {
        const fv = new Date(v.fecha);
        return fv >= inicioMes && fv <= finMes;
      });
      result.push({
        label: meses[m],
        orden: m,
        sede1: ventasMes.filter((v) => v.sede === "sede1").reduce((s, v) => s + (v.total || 0), 0),
        sede2: ventasMes.filter((v) => v.sede === "sede2").reduce((s, v) => s + (v.total || 0), 0),
      });
    }
    return result;
  }

  return [];
};

const DashboardPage = () => {
  const { sedeActiva } = useSede();
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [periodo, setPeriodo] = useState("7d");
  const [panelAlertas, setPanelAlertas] = useState(false);

  useEffect(() => {
    const unsubV = onSnapshot(collection(db, "sales"), (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubP = onSnapshot(collection(db, "products"), (snap) => {
      setProductos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubV();
      unsubP();
    };
  }, []);

  // Alertas por sede activa (usa las banderas del centinela silencioso)
  const bajoStockEnSede = useMemo(
    () => productos.filter((p) => stockDe(p, sedeActiva) <= p.minimo),
    [productos, sedeActiva]
  );
  const sinLeer = bajoStockEnSede.filter((p) => !p[`alertaVista_${sedeActiva}`]);

  const abrirPanelAlertas = () => {
    setPanelAlertas(true);
    sinLeer.forEach((p) => {
      updateDoc(doc(db, "products", p.id), { [`alertaVista_${sedeActiva}`]: true });
    });
  };

  const datosGrafica = useMemo(() => agruparVentas(ventas, periodo), [ventas, periodo]);
  const maxBar = Math.max(...datosGrafica.flatMap((d) => [d.sede1, d.sede2]), 1);

  // Tarjetas
  const inicioHoy = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  );
  const ventasHoy = ventas.filter((v) => new Date(v.fecha) >= inicioHoy);
  const totalHoy = ventasHoy.reduce((s, v) => s + (v.total || 0), 0);
  const unidadesHoy = ventasHoy.reduce(
    (s, v) => s + (v.items || []).reduce((a, i) => a + i.cantidad, 0),
    0
  );

  const ventasPeriodo = useMemo(() => {
    const ahora = new Date();
    if (periodo === "hoy") return ventasHoy;
    if (periodo === "7d") {
      const desde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 6);
      return ventas.filter((v) => new Date(v.fecha) >= desde);
    }
    if (periodo === "mes") {
      const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      return ventas.filter((v) => new Date(v.fecha) >= desde);
    }
    if (periodo === "año") {
      const desde = new Date(ahora.getFullYear(), 0, 1);
      return ventas.filter((v) => new Date(v.fecha) >= desde);
    }
    return ventas;
  }, [ventas, periodo, ventasHoy]);

  const totalPeriodo = ventasPeriodo.reduce((s, v) => s + (v.total || 0), 0);

  // Top 5 productos del periodo
  const topProductos = useMemo(() => {
    const mapa = {};
    ventasPeriodo.forEach((v) =>
      (v.items || []).forEach((i) => {
        if (!mapa[i.nombre]) mapa[i.nombre] = { nombre: i.nombre, unidades: 0, total: 0 };
        mapa[i.nombre].unidades += i.cantidad;
        mapa[i.nombre].total += i.cantidad * (i.precio || 0);
      })
    );
    return Object.values(mapa).sort((a, b) => b.unidades - a.unidades).slice(0, 5);
  }, [ventasPeriodo]);

  return (
    <Animate>
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
          <Typography variant="h5" fontWeight={700}>Estadísticas</Typography>
          <IconButton onClick={abrirPanelAlertas} color={sinLeer.length ? "error" : "default"}>
            <Badge badgeContent={sinLeer.length} color="error">
              <NotificationsOutlinedIcon />
            </Badge>
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Pulso del negocio — vendiendo en <b>{nombreSede(sedeActiva)}</b>
        </Typography>

        {/* Panel lateral de alertas */}
        <Drawer anchor="right" open={panelAlertas} onClose={() => setPanelAlertas(false)}>
          <Box sx={{ width: 340, p: 3 }}>
            <Typography variant="h6" fontWeight={700} mb={1}>
              🔔 Alertas de stock · {nombreSede(sedeActiva)}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Productos en o por debajo del mínimo en esta sede.
            </Typography>
            {bajoStockEnSede.length === 0 ? (
              <Typography variant="body2" sx={{ py: 3, textAlign: "center" }}>
                Todo el inventario está por encima del mínimo ✔️
              </Typography>
            ) : (
              <List dense>
                {bajoStockEnSede.map((p) => (
                  <ListItem key={p.id}>
                    <ListItemText
                      primary={p.nombre}
                      secondary={`Quedan ${stockDe(p, sedeActiva)} · mínimo ${p.minimo}`}
                      primaryTypographyProps={{ fontWeight: 700 }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Drawer>

        {/* 4 tarjetas */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              icono={<AttachMoneyOutlinedIcon />}
              color="#2e7d32"
              valor={cop(totalHoy)}
              titulo="Vendido hoy"
              detalle="Dinero esperado en caja"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              icono={<ReceiptLongOutlinedIcon />}
              color="#1565c0"
              valor={ventasHoy.length}
              titulo="Ventas de hoy"
              detalle={`${unidadesHoy} unidades vendidas`}
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              icono={<WarningAmberOutlinedIcon />}
              color="#e65100"
              valor={bajoStockEnSede.length}
              titulo="Con bajo stock"
              detalle={`En ${nombreSede(sedeActiva)}`}
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              icono={<ShoppingBasketOutlinedIcon />}
              color="#6a1b9a"
              valor={cop(totalPeriodo)}
              titulo={TITULO_CAMALEON[periodo]}
              detalle="Consolidado ambas sedes"
            />
          </Grid>
        </Grid>

        {/* Selector de periodo + gráfica + top productos */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
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
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, height: "100%" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography fontWeight={700}>Ventas por {ETIQUETAS_PERIODO[periodo].toLowerCase()}</Typography>
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: "3px", bgcolor: colors.blue[600] }} />
                    <Typography variant="caption">Sede Principal</Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: "3px", bgcolor: colors.orange[600] }} />
                    <Typography variant="caption">Sede 2</Typography>
                  </Box>
                </Box>
              </Box>

              {datosGrafica.length === 0 || (datosGrafica.every(d => d.sede1 === 0 && d.sede2 === 0)) ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
                  No hay ventas en este periodo.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, height: 220 }}>
                  {datosGrafica.map((d) => (
                    <Box
                      key={d.label}
                      sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.3, height: 180 }}>
                        <Box
                          title={`${nombreSede("sede1")}: ${cop(d.sede1)}`}
                          sx={{
                            width: periodo === "año" ? 14 : 18,
                            borderRadius: "6px 6px 0 0",
                            bgcolor: colors.blue[600],
                            height: `${(d.sede1 / maxBar) * 170}px`,
                            transition: "height 0.3s",
                            minHeight: d.sede1 > 0 ? 4 : 0,
                          }}
                        />
                        <Box
                          title={`${nombreSede("sede2")}: ${cop(d.sede2)}`}
                          sx={{
                            width: periodo === "año" ? 14 : 18,
                            borderRadius: "6px 6px 0 0",
                            bgcolor: colors.orange[600],
                            height: `${(d.sede2 / maxBar) * 170}px`,
                            transition: "height 0.3s",
                            minHeight: d.sede2 > 0 ? 4 : 0,
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {d.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: "100%" }}>
              <Typography fontWeight={700} mb={1}>🏆 Top productos del periodo</Typography>
              {topProductos.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                  Sin ventas en el periodo.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><b>Producto</b></TableCell>
                      <TableCell align="center"><b>Uds.</b></TableCell>
                      <TableCell align="right"><b>Total</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topProductos.map((p) => (
                      <TableRow key={p.nombre} hover>
                        <TableCell>{p.nombre}</TableCell>
                        <TableCell align="center">{p.unidades}</TableCell>
                        <TableCell align="right">{cop(p.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Animate>
  );
};

export default DashboardPage;