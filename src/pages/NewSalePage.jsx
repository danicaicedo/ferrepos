import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
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
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import { addDoc, collection, doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import {
  campoStock,
  nombreSede,
  stockDe,
  METODOS_PAGO_POR_SEDE,
  METODOS_PAGO_LABELS,
} from "../config";
import { useSede } from "../context/SedeContext";
import { registrarMovimiento } from "../movimientos";
import { revisarCentinela } from "../centinela";

const NewSalePage = () => {
  const { sedeActiva } = useSede();
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const [productos, setProductos] = useState([]);
  const [productoSel, setProductoSel] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [carrito, setCarrito] = useState([]);
  const [metodo, setMetodo] = useState("efectivo");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [snack, setSnack] = useState({ open: false, mensaje: "", error: false });
  const [busqueda, setBusqueda] = useState("");

  // 🔗 Conexión en vivo con la colección "productos" con NORMALIZACIÓN de datos
  useEffect(
    () =>
      onSnapshot(collection(db, "productos"), (snap) => {
        const lista = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              nombre: data.nombre || "Sin nombre",
              codigo: data.codigo || "",
              categoria: data.categoria || "General",
              // Aseguramos que sean números para evitar fallos en las comparaciones
              precio: Number(data.precio) || 1000,
              stockSede1: Number(data.stockSede1) || 0,
              stockSede2: Number(data.stockSede2) || 0,
              stockMinimo: Number(data.stockMinimo) || 5,
            };
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        setProductos(lista);
      }),
    []
  );

  // El total ahora usa el precio cobrado (editado) o el precio base
  const total = carrito.reduce((s, i) => s + (i.precioCobrado || i.precio) * i.cantidad, 0);
  const metodosDisponibles = METODOS_PAGO_POR_SEDE[sedeActiva] || METODOS_PAGO_POR_SEDE.sede1;

  // Filtrar productos según la búsqueda
  const productosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return productos.slice(0, 50);
    const busquedaLower = busqueda.toLowerCase();
    return productos
      .filter((p) => 
        p.nombre.toLowerCase().includes(busquedaLower) ||
        p.codigo.toLowerCase().includes(busquedaLower)
      )
      .slice(0, 50);
  }, [busqueda, productos]);

  const agregarAlCarrito = () => {
    if (!productoSel) {
      return setSnack({ open: true, mensaje: "Selecciona un producto de la lista.", error: true });
    }
    
    const enCarrito = carrito.find((i) => i.productoId === productoSel.id)?.cantidad || 0;
    const disponible = stockDe(productoSel, sedeActiva);
    
    // Validación de stock
    if (!cantidad || cantidad <= 0 || enCarrito + cantidad > disponible) {
      return setSnack({
        open: true,
        mensaje: `⚠️ Stock insuficiente en ${nombreSede(sedeActiva)}. Disponible: ${disponible}`,
        error: true,
      });
    }
    
    setCarrito((c) => {
      const existe = c.find((i) => i.productoId === productoSel.id);
      if (existe) {
        return c.map((i) =>
          i.productoId === productoSel.id ? { ...i, cantidad: i.cantidad + cantidad } : i
        );
      }
      return [
        ...c,
        {
          productoId: productoSel.id,
          nombre: productoSel.nombre,
          precio: productoSel.precio, // Precio base original
          precioCobrado: productoSel.precio, // Precio que se puede editar
          cantidad,
        },
      ];
    });
    
    // Limpiar selección para la siguiente búsqueda
    setProductoSel(null);
    setBusqueda("");
    setCantidad(1);
  };

  // Función para cambiar la cantidad en el carrito
  const cambiarCantidad = (id, nueva) => {
    if (!nueva || nueva < 1) return;
    const prod = productos.find((p) => p.id === id);
    const disponible = stockDe(prod, sedeActiva);
    
    if (nueva > disponible) {
      return setSnack({
        open: true,
        mensaje: `⚠️ Stock insuficiente. Disponible: ${disponible}`,
        error: true,
      });
    }
    setCarrito((c) => c.map((i) => (i.productoId === id ? { ...i, cantidad: nueva } : i)));
  };

  // Función para editar el precio manualmente en el carrito
  const cambiarPrecio = (id, nuevoPrecio) => {
    setCarrito((c) => 
      c.map((i) => 
        i.productoId === id ? { ...i, precioCobrado: Number(nuevoPrecio) || 0 } : i
      )
    );
  };

  const quitarDelCarrito = (id) => setCarrito((c) => c.filter((i) => i.productoId !== id));

  const confirmarVenta = async () => {
    if (carrito.length === 0) {
      return setSnack({ open: true, mensaje: "El carrito está vacío.", error: true });
    }
    setGuardando(true);
    try {
      const campo = campoStock(sedeActiva);
      const stocksFinales = [];

      await runTransaction(db, async (tx) => {
        const lecturas = [];
        for (const item of carrito) {
          const ref = doc(db, "productos", item.productoId);
          const snap = await tx.get(ref);
          lecturas.push({ item, ref, data: snap.data() || {} });
        }

        for (const l of lecturas) {
          const actual = Number(l.data[campo] ?? 0);
          if (actual < l.item.cantidad) {
            throw new Error(`Stock insuficiente para: ${l.item.nombre}`);
          }
        }

        for (const l of lecturas) {
          const actual = Number(l.data[campo] ?? 0);
          const nuevo = actual - l.item.cantidad;
          tx.update(l.ref, { [campo]: nuevo });
          stocksFinales.push({ item: l.item, nuevo });
        }
      });

      const refVenta = await addDoc(collection(db, "ventas"), {
        vendedorUid: user?.uid || "sin-uid",
        vendedorNombre: user?.displayName || "Sin nombre",
        sede: sedeActiva,
        items: carrito.map((i) => ({
          productoId: i.productoId,
          nombre: i.nombre,
          precioBase: i.precio,
          precioCobrado: i.precioCobrado || i.precio, // Guardamos el precio editado
          cantidad: i.cantidad,
          subtotal: (i.precioCobrado || i.precio) * i.cantidad,
        })),
        pagos: [
          {
            metodo,
            monto: total,
            referencia: metodo !== "efectivo" ? referencia : "",
          },
        ],
        total,
        fecha: new Date().toISOString(),
      });

      for (const s of stocksFinales) {
        registrarMovimiento({
          productoId: s.item.productoId,
          productoNombre: s.item.nombre,
          tipo: "salida_venta",
          cantidad: s.item.cantidad,
          stockResultante: s.nuevo,
          sede: sedeActiva,
          usuarioNombre: user?.displayName || "Sin nombre",
          referencia: `Venta ${refVenta.id.slice(0, 6)}`,
          origen: "venta",
        });
      }

      revisarCentinela();
      setCarrito([]);
      setMetodo("efectivo");
      setReferencia("");
      setSnack({
        open: true,
        mensaje: `✅ Venta registrada en ${nombreSede(sedeActiva)} por $${total.toLocaleString("es-CO")}.`,
        error: false,
      });
    } catch (e) {
      setSnack({ open: true, mensaje: e.message || "Error registrando la venta.", error: true });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          Registrar venta
        </Typography>
        <Chip label={`Vendiendo en: ${nombreSede(sedeActiva)}`} color="primary" />
      </Stack>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-end" }}>
          {/* 🔍 BUSCADOR CON AUTOCOMPLETADO */}
          <Autocomplete
            size="small"
            sx={{ minWidth: 300 }}
            options={productosFiltrados}
            getOptionLabel={(option) => `${option.nombre} (Stock: ${stockDe(option, sedeActiva)})`}
            value={productoSel}
            onChange={(e, val) => {
              setProductoSel(val);
              setBusqueda("");
            }}
            inputValue={busqueda}
            onInputChange={(e, val) => setBusqueda(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Buscar producto..."
                placeholder="Escribe el nombre o código"
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography variant="body2" fontWeight={600}>
                    {option.nombre}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Stock: {stockDe(option, sedeActiva)} | Base: ${Number(option.precio).toLocaleString("es-CO")}
                  </Typography>
                </Box>
              </li>
            )}
            noOptionsText="No se encontraron productos"
          />
          
          <TextField
            size="small"
            type="number"
            label="Cantidad"
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            inputProps={{ min: 1 }}
            sx={{ width: 110 }}
          />
          <Button 
            variant="contained" 
            startIcon={<AddShoppingCartIcon />} 
            onClick={agregarAlCarrito}
            disabled={!productoSel}
          >
            Agregar
          </Button>
        </Stack>

        {carrito.length > 0 && (
          <>
            <TableContainer sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell align="right">Precio Unit. (Editable)</TableCell>
                    <TableCell align="center">Cantidad</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {carrito.map((i) => (
                    <TableRow key={i.productoId}>
                      <TableCell>{i.nombre}</TableCell>
                      <TableCell align="right">
                        {/* ✏️ CAMPO EDITABLE PARA EL PRECIO */}
                        <TextField
                          size="small"
                          type="number"
                          value={i.precioCobrado || i.precio}
                          onChange={(e) => cambiarPrecio(i.productoId, e.target.value)}
                          inputProps={{ 
                            min: 0, 
                            style: { width: 90, textAlign: "right", padding: "4px" } 
                          }}
                          sx={{ 
                            '& .MuiInputBase-input': { textAlign: 'right' },
                            backgroundColor: '#f5f5f5',
                            borderRadius: '4px'
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          size="small"
                          type="number"
                          value={i.cantidad}
                          onChange={(e) => cambiarCantidad(i.productoId, Number(e.target.value))}
                          inputProps={{ min: 1, style: { width: 60, textAlign: "center" } }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <strong>${((i.precioCobrado || i.precio) * i.cantidad).toLocaleString("es-CO")}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => quitarDelCarrito(i.productoId)} color="error">
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} align="right">
                      <Typography variant="h6"><strong>TOTAL</strong></Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="h6" color="primary">
                        <strong>${total.toLocaleString("es-CO")}</strong>
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mt={2} alignItems={{ sm: "center" }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Método de pago</InputLabel>
                <Select value={metodo} label="Método de pago" onChange={(e) => setMetodo(e.target.value)}>
                  {metodosDisponibles.map((m) => (
                    <MenuItem key={m} value={m}>
                      {METODOS_PAGO_LABELS[m]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {metodo !== "efectivo" && (
                <TextField
                  size="small"
                  label="Referencia (opcional)"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  sx={{ minWidth: 240 }}
                />
              )}
            </Stack>

            <Button
              variant="contained"
              size="large"
              fullWidth
              sx={{ mt: 2, py: 1.5 }}
              disabled={guardando}
              onClick={confirmarVenta}
            >
              {guardando ? "Registrando…" : `Confirmar venta por $${total.toLocaleString("es-CO")}`}
            </Button>
          </>
        )}
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={snack.error ? "warning" : "success"}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snack.mensaje}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NewSalePage;