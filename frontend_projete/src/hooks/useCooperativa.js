import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_API_URL } from "../config/api";
import { fetchAutenticado } from "../services/apiAutenticado";

export async function requisitarCooperativa(caminho, opcoes = {}) {
  const resposta = await fetchAutenticado(`${AUTH_API_URL}${caminho}`, opcoes);
  const dados = resposta.status === 204 ? null : await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(dados?.mensagem || `Não foi possível concluir a solicitação (${resposta.status}).`);
  return dados;
}

const recursos = { usuarios: "/cooperativa/usuarios", dashboard: "/cooperativa/dashboard", ranking: "/cooperativa/ranking-agronomos" };
const inicial = { dados: null, carregando: true, erro: "" };
export default function useCooperativa() {
  const [estado, setEstado] = useState({ usuarios: inicial, dashboard: inicial, ranking: inicial });
  const requisicoes = useRef({});
  const carregar = useCallback(async (chave) => {
    requisicoes.current[chave]?.abort();
    const controller = new AbortController();
    requisicoes.current[chave] = controller;
    setEstado(atual => ({ ...atual, [chave]: { ...atual[chave], carregando: true, erro: "" } }));
    try {
      const dados = await requisitarCooperativa(recursos[chave], { signal: controller.signal });
      if (chave === "dashboard" ? !dados || typeof dados !== "object" || Array.isArray(dados) : !Array.isArray(dados)) {
        throw new Error("O servidor retornou dados inválidos. Tente novamente.");
      }
      if (!controller.signal.aborted) setEstado(atual => ({ ...atual, [chave]: { dados, carregando: false, erro: "" } }));
    } catch (erro) {
      if (!controller.signal.aborted) setEstado(atual => ({ ...atual, [chave]: { ...atual[chave], carregando: false, erro: erro.message || "Não foi possível conectar ao servidor." } }));
    }
  }, []);
  const atualizar = useCallback(() => Promise.all(Object.keys(recursos).map(carregar)), [carregar]);
  useEffect(() => {
    atualizar();
    const ativos = requisicoes.current;
    return () => Object.values(ativos).forEach(controller => controller.abort());
  }, [atualizar]);
  return { ...estado, carregar, atualizar };
}
