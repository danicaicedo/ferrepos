import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
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
  Alert,
  Chip,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { GROQ_API_KEY } from "../config";

const OCRDialog = ({ open, onClose, onConfirm }) => {
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [productos, setProductos] = useState([]);
  const [error, setError] = useState(null);
  const [textoCrudo, setTextoCrudo] = useState("");
  const [mostrarTexto, setMostrarTexto] = useState(false);

  const manejarArchivo = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setImagen(archivo);
    setPreview(URL.createObjectURL(archivo));
    setProductos([]);
    setError(null);
    setTextoCrudo("");
  };

  const procesarImagen = async () => {
    if (!imagen) return;
    setProcesando(true);
    setError(null);
    setTextoCrudo("");
    try {
      const base64 = await convertirABase64(imagen);
      
      const prompt = `Eres un experto en extracción de datos de facturas de ferretería. 
Analiza esta factura y extrae TODOS los productos. 
Devuelve SOLO un JSON válido con este formato exacto:
{
  "productos": [
    {"nombre": "nombre del producto", "cantidad": 10, "precio": 3361}
  ]
}

Reglas:
- Extrae solo productos (ignora totales, IVA, subtotal, encabezados)
- La cantidad debe ser un número entero
- El precio debe ser un número (sin puntos de miles, sin signos de $)
- Si no encuentras cantidad, asume 1. Si no encuentras precio, pon 0.
Devuelve solo el JSON, sin texto adicional.`;

      const respuesta = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen/qwen3.8-27b", 
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: base64 } },
                { type: "text", text: prompt },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (!respuesta.ok) {
        const errorData = await respuesta.json();
        throw new Error(errorData.error?.message || `Error ${respuesta.status}`);
      }

      const datos = await respuesta.json();
      const contenido = datos.choices?.[0]?.message?.content || "";
      
      setTextoCrudo(contenido);
      
      const jsonMatch = contenido.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("La IA no devolvió un JSON válido");
      }
      
      const resultado = JSON.parse(jsonMatch[0]);
      const detectados = resultado.productos || [];
      
      setProductos(detectados.map(p => ({
        nombre: p.nombre || "",
        cantidad: p.cantidad || 1,
        precio: p.precio || 0,
        sede1: 0,
        sede2: 0,
      })));
      
      if (detectados.length === 0) {
        setError("No se detectaron productos. Puedes agregarlos manualmente.");
      }
    } catch (e) {
      setError("Error al procesar: " + e.message);
    } finally {
      setProcesando(false);
    }
  };

  const convertirABase64 = (archivo) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(archivo);
    });
  };

  const actualizarProducto = (index, campo, valor) => {
    setProductos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [campo]: valor } : p))
    );
  };

  const agregarFila = () => {
    setProductos((prev) => [
      ...prev,
      { nombre: "", cantidad: 1, precio: 0, sede1: 0, sede2: 0 },
    ]);
  };

  const eliminarFila = (index) => {
    setProductos((prev) => prev.filter((_, i) => i !== index));
  };

  const confirmar = () => {
    const validos = productos.filter((p) => p.nombre.trim() && p.cantidad > 0);
    if (validos.length === 0) {
      setError("Agrega al menos un producto válido.");
      return;
    }
    if (onConfirm) onConfirm(validos);
    limpiar();
  };

  const limpiar = () => {
    setImagen(null);
    setPreview(null);
    setProductos([]);
    setError(null);
    setTextoCrudo("");
    setMostrarTexto(false);
    onClose();
  };

  // Función auxiliar para manejar inputs numéricos sin el problema del "035"
  const manejarCambioNumerico = (index, campo, valor) => {
    // Permitir vacío o solo números
    if (valor === "" || /^\d+$/.test(valor)) {
      actualizarProducto(index, campo, valor === "" ? 0 : Number(valor));
    }
  };

  const totalRepartido = productos.reduce((s, p) => s + (Number(p.sede1) || 0) + (Number(p.sede2) || 0), 0);
  const totalDetectado = productos.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);

  return (
    <Dialog open={open} onClose={limpiar} maxWidth="md" fullWidth>
      <DialogTitle component="div" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6" fontWeight={700}>
          Escanear factura
        </Typography>
        <IconButton onClick={limpiar} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!preview && (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <input
              accept="image/*"
              type="file"
              id="ocr-input"
              style={{ display: "none" }}
              onChange={manejarArchivo}
              capture="environment"
            />
            <label htmlFor="ocr-input">
              <Button
                variant="contained"
                size="large"
                component="span"
                startIcon={<PhotoCameraIcon />}
                sx={{ py: 2, px: 6, fontSize: "1.1rem" }}
              >
                Tomar foto o subir factura
              </Button>
            </label>
          </Box>
        )}

        {preview && !procesando && productos.length === 0 && (
          <Box>
            <Paper sx={{ p: 1, mb: 3, textAlign: "center" }}>
              <img src={preview} alt="factura" style={{ maxWidth: "100%", maxHeight: 350 }} />
            </Paper>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="outlined" onClick={() => { setPreview(null); setImagen(null); }}>
                Cambiar foto
              </Button>
              <Button variant="contained" onClick={procesarImagen} startIcon={<PhotoCameraIcon />} size="large">
                Escanear
              </Button>
            </Stack>
          </Box>
        )}

        {procesando && (
          <Box sx={{ py: 4 }}>
            <Typography variant="body1" mb={2}>Analizando factura...</Typography>
            <LinearProgress />
          </Box>
        )}

        {(productos.length > 0 || preview) && !procesando && (
          <Box>
            {error && (
              <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>
            )}
            
            {productos.length > 0 && (
              <Alert severity="success" sx={{ mb: 2 }}>
                ✅ Se detectaron {productos.length} producto(s)
              </Alert>
            )}

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell><b>Producto</b></TableCell>
                    <TableCell align="center" sx={{ width: 100 }}><b>Cant.</b></TableCell>
                    <TableCell align="right" sx={{ width: 120 }}><b>Precio</b></TableCell>
                    <TableCell align="center" sx={{ width: 100 }}>
                      <Chip size="small" label="Sede 1" color="primary" />
                    </TableCell>
                    <TableCell align="center" sx={{ width: 100 }}>
                      <Chip size="small" label="Sede 2" color="secondary" />
                    </TableCell>
                    <TableCell align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          No hay productos. Haz clic en "Agregar producto" para empezar.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    productos.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <TextField
                            size="small"
                            value={p.nombre}
                            onChange={(e) => actualizarProducto(i, "nombre", e.target.value)}
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="text"
                            inputMode="numeric"
                            value={p.cantidad === 0 ? "" : p.cantidad}
                            onChange={(e) => manejarCambioNumerico(i, "cantidad", e.target.value)}
                            onFocus={(e) => e.target.select()}
                            inputProps={{ style: { textAlign: "center" } }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="text"
                            inputMode="numeric"
                            value={p.precio === 0 ? "" : p.precio}
                            onChange={(e) => manejarCambioNumerico(i, "precio", e.target.value)}
                            onFocus={(e) => e.target.select()}
                            inputProps={{ style: { textAlign: "right" } }}
                            sx={{ width: 120 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="text"
                            inputMode="numeric"
                            value={p.sede1 === 0 ? "" : p.sede1}
                            onChange={(e) => manejarCambioNumerico(i, "sede1", e.target.value)}
                            onFocus={(e) => e.target.select()}
                            inputProps={{ style: { textAlign: "center" } }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="text"
                            inputMode="numeric"
                            value={p.sede2 === 0 ? "" : p.sede2}
                            onChange={(e) => manejarCambioNumerico(i, "sede2", e.target.value)}
                            onFocus={(e) => e.target.select()}
                            inputProps={{ style: { textAlign: "center" } }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => eliminarFila(i)} color="error">
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Button startIcon={<AddIcon />} onClick={agregarFila} sx={{ mt: 2 }} size="small">
              + Agregar producto
            </Button>

            {productos.length > 0 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
                <Typography variant="body2">
                  <b>Total detectado:</b> {totalDetectado} unidades · <b>Total repartido:</b> {totalRepartido} unidades
                  {totalRepartido !== totalDetectado && (
                    <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                      ⚠️ La suma de Sede 1 + Sede 2 no coincide con la cantidad detectada.
                    </Alert>
                  )}
                </Typography>
              </Box>
            )}

            {textoCrudo && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 1 }} />
                <Button
                  size="small"
                  startIcon={<VisibilityIcon />}
                  onClick={() => setMostrarTexto(!mostrarTexto)}
                >
                  {mostrarTexto ? "Ocultar" : "Ver"} detalle técnico
                </Button>
                {mostrarTexto && (
                  <Paper sx={{ p: 2, mt: 1, bgcolor: "grey.100", maxHeight: 200, overflow: "auto" }}>
                    <Typography variant="caption" component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                      {textoCrudo}
                    </Typography>
                  </Paper>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      {productos.length > 0 && (
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={limpiar}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={confirmar}
            disabled={totalRepartido !== totalDetectado}
          >
            Confirmar entrada ({totalRepartido} unidades)
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default OCRDialog;