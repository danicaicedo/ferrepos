import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  colors
} from "@mui/material";
import React, { useState } from "react";
import { images } from "../assets";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ADMIN_EMAIL } from "../config";
import Animate from "../components/common/Animate";

const RegisterPage = () => {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = async (e) => {
    e.preventDefault();
    setError("");

    const correoLimpio = email.trim().toLowerCase();

    if (!nombre || !correoLimpio || !password || !confirmPassword) {
      setError("Por favor completa todos los campos.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener mínimo 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        correoLimpio,
        password
      );
      const user = userCredential.user;

      await updateProfile(user, { displayName: nombre });

            // Única forma de ser admin: tener el correo configurado
      const rol = correoLimpio === ADMIN_EMAIL ? "admin" : "vendedor";

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        nombre,
        email: correoLimpio,
        rol,
        createdAt: new Date().toISOString(),
      });

      console.log("Usuario registrado:", user.email, "con rol:", rol);

      navigate("/");
    } catch (err) {
      console.error("Error al registrar:", err);
      setLoading(false);

      if (err.code === "auth/email-already-in-use") {
        setError("Este correo ya está registrado.");
      } else if (err.code === "auth/invalid-email") {
        setError("El correo electrónico no es válido.");
      } else if (err.code === "auth/weak-password") {
        setError("La contraseña es demasiado débil.");
      } else {
        setError("No se pudo crear la cuenta. Intenta nuevamente.");
      }
    }
  };

  return (
    <Box
      position="relative"
      height="100vh"
      sx={{ "::-webkit-scrollbar": { display: "none" } }}
    >
      <Box
        sx={{
          position: "absolute",
          right: 0,
          height: "100%",
          width: "70%",
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundImage: `url(${images.loginBg})`
        }}
      />

      <Box
        sx={{
          position: "absolute",
          left: 0,
          height: "100%",
          width: { xl: "30%", lg: "40%", md: "50%", xs: "100%" },
          bgcolor: colors.common.white
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%"
          }}
        >
          <Box sx={{ textAlign: "center", p: 5 }}>
            <Animate type="fade" delay={0.5}>
              <img src={images.logo} alt="logo" height={120} />
            </Animate>
          </Box>

          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Animate type="fade" sx={{ maxWidth: 420, width: "100%" }}>
              <Box
                component="form"
                maxWidth={420}
                width="100%"
                onSubmit={onRegister}
              >
                <Stack spacing={3}>
                  <TextField
                    label="Nombre"
                    fullWidth
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />

                  <TextField
                    label="Email"
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

                  <TextField
                    label="Confirmar contraseña"
                    type="password"
                    fullWidth
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    disabled={loading}
                    sx={{ backgroundColor: "black" }}
                  >
                    {loading ? "Registrando..." : "Registrarse"}
                  </Button>

                  <Typography textAlign="center">
                    ¿Ya tienes una cuenta?{" "}
                    <Link to="/">Inicia sesión</Link>
                  </Typography>
                </Stack>
              </Box>
            </Animate>
          </Box>

          <Box sx={{ textAlign: "center", p: 5, zIndex: 2 }}>
            <Typography variant="caption">© Ferreteria</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RegisterPage;