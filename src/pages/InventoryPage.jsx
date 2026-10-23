import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Pagination,
  Alert,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/Add";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { revisarCentinela } from "../centinela";
import EditOutlinedIcon from "@mui/icons-material/Edit";
import SearchOutlinedIcon from "@mui/icons-material/Search";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { asegurarProductosIniciales } from "../seedProductos";
import Animate from "../components/common/Animate";
import OCRDialog from "../components/OCRDialog";
import { GROQ_API_KEY } from "../config"; // ⚠️ IMPORTANTE: Asegúrate de que esta línea esté aquí

const cop = (n) => "$" + Number(n).toLocaleString("es-CO");

const FORM_VACIO = { nombre: "", categoria: "", precio: "", stock: "", minimo: "" };

const InventoryPage = () => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  
  const [pendientesRevision, setPendientesRevision] = useState([]);
  const [revisionOpen, setRevisionOpen] = useState(false);

  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 50;

  useEffect(() => {
    asegurarProductosIniciales();
    revisarCentinela(); 
    const unsub = onSnapshot(collection(db, "productos"), (s) => {
      const lista = s.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nombre: data.nombre,
          categoria: data.categoria || "General",
          precio: Number(data.precio) || 0,
          stock: (Number(data.stockSede1) || 0) + (Number(data.stockSede2) || 0),
          minimo: Number(data.stockMinimo) || 5,
          codigo: data.codigo,
          stockSede1: Number(data.stockSede1) || 0,
          stockSede2: Number(data.stockSede2) || 0,
        };
      });
      setProductos(lista);
      setCargando(false);
    });
    return unsub;
  }, []);

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);
  const inicio = (paginaActual - 1) * productosPorPagina;
  const fin = inicio + productosPorPagina;
  const productosPagina = productosFiltrados.slice(inicio, fin);

  useEffect(() => { setPaginaActual(1); }, [busqueda]);

  const abrirNuevo = () => { setEditando(null); setForm(FORM_VACIO); setDialogOpen(true); };
  const abrirEdicion = (p) => {
    setEditando(p);
    setForm({ nombre: p.nombre, categoria: p.categoria, precio: String(p.precio), stock: String(p.stock), minimo: String(p.minimo) });
    setDialogOpen(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.precio) return;
    const data = {
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim() || "General",
      precio: Number(form.precio) || 0,
      stockSede1: Number(form.stock) || 0,
      stockSede2: 0,
      stockMinimo: Number(form.minimo) || 5,
    };
    try {
      if (editando) {
        await updateDoc(doc(db, "productos", editando.id), data);
      } else {
        await addDoc(collection(db, "productos"), { ...data, codigo: editando?.codigo || `PROD-${Date.now()}`, unidad: "UN", fechaCreacion: new Date() });
      }
      revisarCentinela();
      setDialogOpen(false);
    } catch (e) { console.error("Error guardando producto:", e); }
  };

  //  PROCESAR FACTURA ESCANEADA CON GROQ (INTELIGENCIA REAL)
  const procesarFacturaOCR = async (productosDetectados) => {
    console.log("📦 Productos detectados por OCR:", productosDetectados);
    
    const productosVinculados = [];
    const noEncontrados = [];

    for (const producto of productosDetectados) {
      const { nombre, cantidad, precio, sede1, sede2 } = producto;
      const totalUnidades = (sede1 || 0) + (sede2 || 0) || cantidad;

      console.log(`\n🔍 Buscando: "${nombre}"`);
      
      // 1. Buscar coincidencia exacta primero (Rápido)
      const nombreLower = nombre.toLowerCase().trim();
      let productoExistente = productos.find((p) => p.nombre.toLowerCase().trim() === nombreLower);
      
      if (productoExistente) {
        console.log(`✅ Coincidencia EXACTA encontrada: ${productoExistente.nombre}`);
        const nuevoStockSede1 = productoExistente.stockSede1 + totalUnidades;
        await updateDoc(doc(db, "productos", productoExistente.id), {
          stockSede1: nuevoStockSede1,
          precio: precio || productoExistente.precio,
        });
        productosVinculados.push(`${nombre} -> ${productoExistente.nombre}`);
        continue;
      }

      // 2. NO hay coincidencia exacta → Usar Groq para búsqueda inteligente
      console.log("🧠 Usando Groq para búsqueda inteligente...");
      
      // Filtrar candidatos locales (productos que compartan al menos 1 palabra clave)
      const palabrasClave = nombre.toLowerCase().split(/\s+/).filter(p => p.length > 2);
      const candidatos = productos.filter(p => {
        const nombreProd = p.nombre.toLowerCase();
        return palabrasClave.some(palabra => nombreProd.includes(palabra));
      }).slice(0, 50); // Máximo 50 candidatos para que la API sea rápida
      
      console.log(` ${candidatos.length} candidatos encontrados localmente`);
      
      if (candidatos.length === 0) {
        console.log("❌ No hay candidatos. Agregando a revisión manual.");
        noEncontrados.push({ nombreOCR: nombre, cantidad: totalUnidades, precio: precio || 0 });
        continue;
      }
      
      // Enviar candidatos a Groq
      try {
        const prompt = `Tengo un producto extraído de una factura: "${nombre}"
        
        Busca en esta lista de productos de mi inventario cuál es el MISMO producto (puede tener abreviaciones, sinónimos o estar escrito diferente):
        
        ${candidatos.map((p, i) => `${i + 1}. ${p.nombre}`).join('\n')}
        
        REGLAS ESTRICTAS:
        - Si encuentras un producto que claramente es el mismo, responde SOLO con el número del producto (ej: "3")
        - Si NO encuentras ningún producto parecido, responde SOLO con: "NO_ENCONTRADO"
        - No escribas nada más, solo el número o "NO_ENCONTRADO".`;
        
        const respuesta = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "qwen/qwen3.8-27b", // El modelo que ya tienes funcionando
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 10,
          }),
        });
        
        if (!respuesta.ok) throw new Error("Error en la API de Groq");
        
        const datos = await respuesta.json();
        const respuestaGroq = datos.choices?.[0]?.message?.content?.trim();
        
        console.log(`🤖 Groq respondió: "${respuestaGroq}"`);
        
        if (respuestaGroq === "NO_ENCONTRADO" || !respuestaGroq || isNaN(parseInt(respuestaGroq))) {
          noEncontrados.push({ nombreOCR: nombre, cantidad: totalUnidades, precio: precio || 0 });
        } else {
          const indice = parseInt(respuestaGroq) - 1;
          if (indice >= 0 && indice < candidatos.length) {
            productoExistente = candidatos[indice];
            console.log(`✅ Groq seleccionó: ${productoExistente.nombre}`);
            
            const nuevoStockSede1 = productoExistente.stockSede1 + totalUnidades;
            await updateDoc(doc(db, "productos", productoExistente.id), {
              stockSede1: nuevoStockSede1,
              precio: precio || productoExistente.precio,
            });
            productosVinculados.push(`${nombre} -> ${productoExistente.nombre}`);
          } else {
            noEncontrados.push({ nombreOCR: nombre, cantidad: totalUnidades, precio: precio || 0 });
          }
        }
      } catch (e) {
        console.error(" Error con Groq:", e);
        noEncontrados.push({ nombreOCR: nombre, cantidad: totalUnidades, precio: precio || 0 });
      }
    }

    console.log("\n Resumen:");
    console.log("✅ Vinculados:", productosVinculados);
    console.log("❌ No encontrados:", noEncontrados);

    // 🟢 ARREGLO 1: Mostrar resumen siempre antes de abrir el diálogo
    const mensajeResumen = `📊 Resumen:\n✅ ${productosVinculados.length} producto(s) actualizado(s) automáticamente.\n⚠️ ${noEncontrados.length} producto(s) requieren revisión manual.`;

    if (noEncontrados.length > 0) {
      alert(mensajeResumen);
      setPendientesRevision(noEncontrados);
      setRevisionOpen(true);
    } else {
      alert(mensajeResumen);
    }
  };

  // 🟢 ARREGLO 2: Confirmación final al terminar la revisión manual
  const guardarRevisionManual = async (pendiente, productoRealId, esNuevo) => {
    try {
      if (esNuevo) {
        await addDoc(collection(db, "productos"), {
          nombre: pendiente.nombreOCR,
          categoria: "General",
          precio: pendiente.precio,
          stockSede1: pendiente.cantidad,
          stockSede2: 0,
          stockMinimo: 5,
          codigo: `PROD-${Date.now()}`,
          unidad: "UN",
          fechaCreacion: new Date(),
        });
        console.log(`✅ Producto CREADO: ${pendiente.nombreOCR}`);
      } else {
        const prodReal = productos.find(p => p.id === productoRealId);
        if (prodReal) {
          await updateDoc(doc(db, "productos", prodReal.id), {
            stockSede1: prodReal.stockSede1 + pendiente.cantidad,
            precio: pendiente.precio || prodReal.precio,
          });
          console.log(`✅ Producto ACTUALIZADO: ${prodReal.nombre} (+${pendiente.cantidad} unidades)`);
        }
      }
      
      // Quitar de la lista de pendientes
      const nuevosPendientes = pendientesRevision.filter(p => p.nombreOCR !== pendiente.nombreOCR);
      setPendientesRevision(nuevosPendientes);
      
      // Si ya no quedan pendientes, cerrar el diálogo y mostrar confirmación final
      if (nuevosPendientes.length === 0) {
        setRevisionOpen(false);
        alert("✅ ¡Listo! Todos los productos fueron procesados correctamente.");
      }
    } catch (e) { 
      console.error("Error en revisión manual:", e);
      alert("❌ Error al guardar: " + e.message);
    }
  };

  // Obtener sugerencias para el modal de revisión manual
  const getSugerencias = (textoOCR) => {
    const textoLimpio = textoOCR.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const palabrasClave = textoLimpio.split(' ').filter(p => p.length > 2);
    
    const sugerencias = productos.map(prod => {
      let puntaje = 0;
      palabrasClave.forEach(p => { if (prod.nombre.toLowerCase().includes(p)) puntaje++; });
      return { ...prod, puntaje };
    }).filter(p => p.puntaje > 0).sort((a, b) => b.puntaje - a.puntaje).slice(0, 5);
    
    return sugerencias;
  };

  return (
    <Animate>
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Inventario</Typography>
            <Typography variant="body2" color="text.secondary">
              {productos.length} productos registrados | Mostrando {productosPagina.length} de {productosFiltrados.length}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField size="small" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment>) }} sx={{ minWidth: 250 }} />
            <Button variant="outlined" startIcon={<PhotoCameraIcon />} onClick={() => setOcrDialogOpen(true)}
              sx={{ borderColor: "black", color: "black", "&:hover": { borderColor: "black", backgroundColor: "rgba(0,0,0,0.04)" } }}>
              📸 Escanear factura
            </Button>
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={abrirNuevo} sx={{ backgroundColor: "black" }}>
              Nuevo producto
            </Button>
          </Box>
        </Box>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><b>Producto</b></TableCell><TableCell><b>Categoría</b></TableCell>
                <TableCell align="right"><b>Precio</b></TableCell><TableCell align="center"><b>Stock</b></TableCell>
                <TableCell align="center"><b>Mínimo</b></TableCell><TableCell align="center"><b>Acciones</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cargando ? (<TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>Cargando productos...</TableCell></TableRow>)
              : productosPagina.length === 0 ? (<TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>No hay productos que coincidan.</TableCell></TableRow>)
              : (productosPagina.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.nombre}</TableCell><TableCell>{p.categoria}</TableCell>
                    <TableCell align="right">{cop(p.precio)}</TableCell>
                    <TableCell align="center"><Chip label={p.stock} size="small" color={p.stock <= p.minimo ? "error" : "success"} variant={p.stock <= p.minimo ? "filled" : "outlined"} /></TableCell>
                    <TableCell align="center">{p.minimo}</TableCell>
                    <TableCell align="center"><IconButton size="small" onClick={() => abrirEdicion(p)}><EditOutlinedIcon fontSize="small" /></IconButton></TableCell>
                  </TableRow>
                )))}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPaginas > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3, mb: 2 }}>
            <Pagination count={totalPaginas} page={paginaActual} onChange={(e, value) => setPaginaActual(value)} color="primary" showFirstButton showLastButton />
          </Box>
        )}

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{editando ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogContent sx={{ pt: "10px !important", display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField label="Nombre" fullWidth value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <TextField label="Categoría" fullWidth value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            <TextField label="Precio (COP)" type="number" fullWidth value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} />
            <TextField label="Stock actual" type="number" fullWidth value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            <TextField label="Stock mínimo" type="number" fullWidth value={form.minimo} onChange={(e) => setForm({ ...form, minimo: e.target.value })} />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button variant="contained" sx={{ backgroundColor: "black" }} onClick={guardar}>Guardar</Button>
          </DialogActions>
        </Dialog>

        <OCRDialog open={ocrDialogOpen} onClose={() => setOcrDialogOpen(false)} onConfirm={procesarFacturaOCR} />

        <Dialog open={revisionOpen} onClose={() => setRevisionOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleOutlineIcon color="primary" /> Revisión de Productos Detectados
          </DialogTitle>
          <DialogContent sx={{ pt: "10px !important" }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              La IA detectó estos productos, pero necesita tu ayuda para vincularlos al inventario correcto.
            </Alert>
            {pendientesRevision.map((pendiente, index) => {
              const sugerencias = getSugerencias(pendiente.nombreOCR);
              return (
                <Box key={index} sx={{ mb: 3, p: 2, border: '1px solid #eee', borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    📄 Leído en factura: "{pendiente.nombreOCR}" (Cant: {pendiente.cantidad})
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
                    <FormControl sx={{ minWidth: 300 }} size="small">
                      <InputLabel>Selecciona producto real o crea nuevo</InputLabel>
                      <Select
                        label="Selecciona producto real o crea nuevo"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value === 'NUEVO') {
                            guardarRevisionManual(pendiente, null, true);
                          } else if (e.target.value) {
                            guardarRevisionManual(pendiente, e.target.value, false);
                          }
                        }}
                      >
                        <MenuItem value="NUEVO" sx={{ color: 'primary.main', fontWeight: 'bold' }}>➕ Crear como producto nuevo</MenuItem>
                        {sugerencias.length > 0 ? sugerencias.map(s => (
                          <MenuItem key={s.id} value={s.id}>{s.nombre} (Coincidencia: {s.puntaje})</MenuItem>
                        )) : <MenuItem disabled>No hay sugerencias cercanas</MenuItem>}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              );
            })}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setRevisionOpen(false)} variant="outlined">Cerrar</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Animate>
  );
};

export default InventoryPage;