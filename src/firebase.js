// Firebase initialization (provided config)
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAoy51fEFsKCGWiC6Qjx5FFymPoiRqDePo",
  authDomain: "ferreteria-43b53.firebaseapp.com",
  projectId: "ferreteria-43b53",
  storageBucket: "ferreteria-43b53.firebasestorage.app",
  messagingSenderId: "263091099494",
  appId: "1:263091099494:web:5f3d568f3625b6123fdaa7",
  measurementId: "G-3RN10ZLR8Z",
};

// Inicializa la app de Firebase
const app = initializeApp(firebaseConfig);

// Analytics (opcional: puede fallar en algunos entornos y no pasa nada)
try {
  getAnalytics(app);
} catch (e) {
  /* analytics may fail in some envs */
}

// 🔐 Autenticación (login con correo y con Google)
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 🗄️ Base de datos Firestore (usuarios con rol, productos, ventas)
const db = getFirestore(app);

// Exportamos los tres para que las páginas los usen
export { auth, provider, db };