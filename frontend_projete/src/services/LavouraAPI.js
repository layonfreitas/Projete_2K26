import { AUTH_API_URL } from "../config/api";

export async function buscarLavouras(usuarioId) {
  const response = await fetch(`${AUTH_API_URL}/lavouras/${usuarioId}`);
  if (!response.ok) {
    throw new Error("Não foi possível buscar as lavouras.");
  }
  return await response.json();
}