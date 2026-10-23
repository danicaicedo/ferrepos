import { addDoc, collection, runTransaction, doc } from "firebase/firestore";
import { db } from "./firebase";
import { campoStock } from "./config";

// 📦 TRAZABILIDAD: todo movimiento de stock queda en la colección "movimientos"
// tipos: 'entrada_compra' | 'salida_venta' | 'ajuste_manual' | 'traslado'
export const registrarMovimiento = async ({
  productoId = null,
  productoNombre = "",
  tipo,
  cantidad,
  stockResultante,
  sede = "sede1",
  usuarioNombre = "Sin nombre",
  referencia = "",
  origen = "manual",
}) => {
  try {
    await addDoc(collection(db, "movimientos"), {
      productoId,
      productoNombre,
      tipo,
      cantidad: Number(cantidad) || 0,
      stockResultante: Number(stockResultante) || 0,
      sede,
      usuarioNombre,
      referencia,
      origen,
      fecha: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Error registrando movimiento:", e);
  }
};

// 🚚 TRASLADO ENTRE SEDES: transacción atómica + movimiento auditado
export const trasladarStock = async ({
  producto,
  cantidad,
  sedeOrigen,
  sedeDestino,
  usuarioNombre = "Sin nombre",
  referencia = "",
}) => {
  const cant = Number(cantidad) || 0;
  if (cant <= 0) throw new Error("La cantidad del traslado debe ser mayor que cero");
  if (sedeOrigen === sedeDestino) throw new Error("El origen y el destino deben ser sedes distintas");

  const cOrigen = campoStock(sedeOrigen);
  const cDestino = campoStock(sedeDestino);
  const stockOrigen = Number(producto[cOrigen]) || 0;
  const stockDestino = Number(producto[cDestino]) || 0;

  if (stockOrigen < cant) {
    throw new Error(`Stock insuficiente en ${sedeOrigen} para trasladar ${producto.nombre}`);
  }

  const ref = doc(db, "products", producto.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const actual = Number(snap.data()?.[cOrigen]) || 0;
    if (actual < cant) {
      throw new Error(`El stock de ${producto.nombre} cambió durante el traslado. Intenta de nuevo.`);
    }
    const nuevoOrigen = actual - cant;
    const nuevoDestino = (Number(snap.data()?.[cDestino]) || 0) + cant;
    tx.update(ref, {
      [cOrigen]: nuevoOrigen,
      [cDestino]: nuevoDestino,
      stock: nuevoOrigen + nuevoDestino,
    });
  });

  await addDoc(collection(db, "movimientos"), {
    productoId: producto.id,
    productoNombre: producto.nombre,
    tipo: "traslado",
    cantidad: cant,
    sede: sedeOrigen,
    sedeOrigen,
    sedeDestino,
    stockResultante: stockOrigen - cant,
    stockResultanteDestino: stockDestino + cant,
    usuarioNombre,
    referencia,
    origen: "manual",
    fecha: new Date().toISOString(),
  });
};