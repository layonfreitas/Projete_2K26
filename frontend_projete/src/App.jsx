import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/login";
import Home from "./pages/home";
import Mapa from "./pages/mapa";
import Cadastro from "./pages/Cadastro";
import Perfil from "./pages/perfil";
import RecuperarSenha from "./pages/RecuperarSenha";
import TrocarSenha from "./pages/TrocarSenha";
import CriarConta from "./pages/CriarConta";
import RotaProtegida from "./components/RotaProtegida";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/home"
        element={
          <RotaProtegida>
            <Home />
          </RotaProtegida>
        }
      />
      <Route
       path="/mapa"
        element={
          <RotaProtegida>
            <Mapa />
          </RotaProtegida>
        }
      />
      <Route
        path="/cadastro"
        element={
          <RotaProtegida>
            <Cadastro />
          </RotaProtegida>
        }
      />
      <Route
        path="/perfil"
        element={
          <RotaProtegida>
            <Perfil />
          </RotaProtegida>
        }
      />

        <Route path="/recuperar-senha" element={<RecuperarSenha />} />

        <Route
          path="/trocar-senha"
          element={
            <RotaProtegida>
              <TrocarSenha />
            </RotaProtegida>
          }
        />

      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
      <Route path="/criar-conta" element={<CriarConta />} />
    </Routes>
  );
}

export default App;