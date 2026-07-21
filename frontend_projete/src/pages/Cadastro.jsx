import { useLocation } from "react-router-dom";
import { useState } from "react";
import "./cadastro.css";

export default function Cadastro() {

  const location = useLocation();
  const coordenadas = location.state?.coordenadas;

  const [nome, setNome] = useState("");
  const [cultura, setCultura] = useState("");
  const [proprietario, setProprietario] = useState("");
  const [observacoes, setObservacoes] = useState("");

  console.log(coordenadas);

  return (
    <div>
      <h1>Cadastro da Lavoura</h1>
    </div>
  );
}