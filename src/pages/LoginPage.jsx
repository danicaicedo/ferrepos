import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
  Link as MuiLink,
  colors,
} from "@mui/material";
import React, { useState } from "react";
import { images } from "../assets";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, provider, db } from "../firebase";
import { ADMIN_EMAIL } from "../config";
import Animate from "../components/common/Animate";

const LoginPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(false);
  const [onRequest, setOnRequest] = useState(false);

  // Estado de la ventanita de recuperación
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetError, setResetError] = useState("");

  // 🧠 El rol se recalcula siempre: solo admin si el correo es ADMIN_EMAIL
  const guardarSesionYRedirigir = async (user) => {
    const correo = user.email?.toLowerCase();
    const rol = correo === ADMIN_EMAIL ? "admin" : "vendedor";
    console.log("✅ Autenticación OK:", correo, "→ rol:", rol);

    try {
      await Promise.race([
        setDoc(
          doc(db, "users", user.uid),
          {
            uid: user.uid,
            nombre: user.displayName || correo,
            email: correo,
            rol,
            ultimoAcceso: new Date().toISOString(),
          },
          { merge: true }
        ),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch (e) {
      console.error("Error sincronizando usuario:", e);
    }

    localStorage.setItem(
      "user",
      JSON.stringify({
        uid: user.uid,
        displayName: user.displayName,
        email: correo,
        photoURL: user.photoURL,
        rol,
      })
    );

    const ruta = rol === "admin" ? "/dashboard" : "/dashboard/ventas/nueva";
    console.log("🚀 Navegando a:", ruta);
    sessionStorage.setItem("ferrepos_sede_pending", "1");
    navigate(ruta);
  };

  const onSignin = async (e) => {
    e.preventDefault();
    setError("");

    const correoLimpio = email.trim().toLowerCase();

    if (!correoLimpio || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    setOnRequest(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, correoLimpio, password);
      await guardarSesionYRedirigir(userCredential.user);
    } catch (err) {
      console.error("Login error:", err);
      setOnRequest(false);

      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Correo o contraseña incorrectos.");
      } else if (err.code === "auth/invalid-email") {
        setError("El correo electrónico no es válido.");
      } else {
        setError("No se pudo iniciar sesión.");
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setOnRequest(true);
      setError("");
      const result = await signInWithPopup(auth, provider);
      await guardarSesionYRedirigir(result.user);
    } catch (err) {
      console.error("Google login error:", err.code, err.message);
      setOnRequest(false);

      if (err.code === "auth/popup-blocked") {
        setError("El navegador bloqueó la ventana emergente. Permite los pop-ups para este sitio.");
      } else if (err.code === "auth/popup-closed-by-user") {
        setError("Cerraste la ventana de Google antes de terminar.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("Dominio no autorizado: entra por http://localhost:3000");
      } else if (err.code === "auth/network-request-failed") {
        setError("Fallo de red al conectar con Google.");
      } else if (err.code === "auth/cancelled-popup-request") {
        setError("Solicitud cancelada. Intenta de nuevo.");
      } else {
        setError(`No se pudo iniciar sesión con Google. (${err.code})`);
      }
    }
  };

  // 📨 Envía el correo de recuperación de contraseña
  const enviarReset = async () => {
    const correo = (resetEmail || email).trim().toLowerCase();
    setResetMsg("");
    setResetError("");

    if (!correo) {
      setResetError("Escribe tu correo electrónico.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, correo);
      setResetMsg(`Listo: enviamos un enlace a ${correo}. Revisa tu bandeja (y la carpeta de spam).`);
    } catch (err) {
      console.error("Reset error:", err.code);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
        setResetError("No hay ninguna cuenta registrada con ese correo.");
      } else if (err.code === "auth/too-many-requests") {
        setResetError("Demasiados intentos. Espera unos minutos y vuelve a probar.");
      } else {
        setResetError(`No se pudo enviar el correo. (${err.code})`);
      }
    }
  };

  return (
    <Box position="relative" height="100vh" sx={{ "::-webkit-scrollbar": { display: "none" } }}>
      {/* Imagen de fondo a la derecha */}
      <Box
        sx={{
          position: "absolute",
          right: 0,
          height: "100%",
          width: "70%",
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundImage: `url(${images.loginBg})`,
        }}
      />

      {/* Panel blanco izquierdo */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          height: "100%",
          width: { xl: "30%", lg: "40%", md: "50%", xs: "100%" },
          transition: "all 0.3s ease-in-out",
          bgcolor: colors.common.white,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            "::-webkit-scrollbar": { display: "none" },
          }}
        >
          {/* Logo GRANDE arriba */}
          <Box sx={{ textAlign: "center", p: 5 }}>
            <Animate type="fade" delay={0.5}>
              <img src={images.logo} alt="logo" height={200} />
            </Animate>
          </Box>

          {/* Formulario centrado */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animate type="fade" sx={{ maxWidth: 420, width: "100%" }}>
              <Box component="form" maxWidth={420} width="100%" onSubmit={onSignin} sx={{ px: 4 }}>
                <Stack spacing={3}>
                  <TextField
                    label="Correo electrónico"
                    type="email"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  <TextField
                    label="Contraseña"
                    type="password"
                    fullWidth
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  {error && (
                    <Typography color="error" textAlign="center">
                      {error}
                    </Typography>
                  )}

                  <Button
                    type="submit"
                    size="large"
                    variant="contained"
                    disabled={onRequest}
                    sx={{ backgroundColor: "black" }}
                  >
                    {onRequest ? "Iniciando sesión..." : "Iniciar sesión"}
                  </Button>

                  <Button
                    variant="outlined"
                    size="large"
                    fullWidth
                    onClick={handleGoogleLogin}
                    disabled={onRequest}
                    sx={{
                      color: "#1a73e8",
                      borderColor: "#1a73e8",
                      "&:hover": {
                        borderColor: "#1a73e8",
                        backgroundColor: "rgba(26,115,232,0.06)",
                      },
                    }}
                  >
                    Iniciar con Google
                  </Button>

                  {/* Recuérdame + Olvidaste tu contraseña */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <FormControlLabel
                      control={
                        <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                      }
                      label="Recuérdame"
                    />
                    <MuiLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setResetEmail(email);
                        setResetMsg("");
                        setResetError("");
                        setResetOpen(true);
                      }}
                      underline="hover"
                      sx={{ color: "#d32f2f", fontWeight: "bold", fontSize: 14 }}
                    >
                      ¿Olvidaste tu contraseña?
                    </MuiLink>
                  </Box>
                </Stack>
              </Box>
            </Animate>
          </Box>

          {/* Abajo: registro */}
          <Box sx={{ textAlign: "center", p: 5, zIndex: 2 }}>
            <Typography sx={{ fontWeight: "bold" }}>
              ¿No tienes una cuenta? -{" "}
              <Link
                to="/register"
                style={{ color: "#d32f2f", fontWeight: "bold", textDecoration: "none" }}
              >
                Regístrate ahora
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Ventanita de recuperación de contraseña */}
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Recuperar contraseña</DialogTitle>
        <DialogContent sx={{ pt: "10px !important", display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2">
            Escribe el correo con el que te registraste y te enviaremos un enlace para crear una contraseña nueva.
          </Typography>
          <TextField
            label="Correo electrónico"
            type="email"
            fullWidth
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
          />
          {resetMsg && <Alert severity="success">{resetMsg}</Alert>}
          {resetError && <Alert severity="error">{resetError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setResetOpen(false)}>Cerrar</Button>
          <Button variant="contained" sx={{ backgroundColor: "black" }} onClick={enviarReset}>
            Enviar enlace
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoginPage;