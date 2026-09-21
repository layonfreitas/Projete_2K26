import { useState } from "react";
import { Field, Pagination, Panel, ResourceState } from "./CoopUI";
const normalizar = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export default function UsuariosPanel({ resource, retry, executar, ocupado, editarSenha }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [pagina, setPagina] = useState(1);
  const [edicao, setEdicao] = useState(null);
  const usuarios = resource.dados || [];
  const agronomos = new Map(usuarios.filter(u => u.tipo === "agronomo").map(u => [String(u.id), u.nome]));
  const filtrados = usuarios.filter(u => (!tipo || u.tipo === tipo) && (!status || (u.tipo === "produtor" && (status === "vinculado" ? !!u.agronomoId : !u.agronomoId))) && normalizar(`${u.nome} ${u.email}`).includes(normalizar(busca)));
  const pages = Math.max(1, Math.ceil(filtrados.length / 6));
  const page = Math.min(pagina, pages);
  function filtrar(setter, valor) { setter(valor); setPagina(1); }
  async function salvar(e) {
    e.preventDefault();
    if (await executar(`/cooperativa/usuario/${edicao.id}`, "PUT", { nome: edicao.nome.trim(), email: edicao.email.trim() }, "Usuário atualizado com sucesso.")) setEdicao(null);
  }
  function excluir(u) {
    if (window.confirm(`Excluir ${u.nome}? Esta ação é permanente${u.tipo === "produtor" ? " e também apaga suas lavouras e observações" : ""}.`)) executar(`/cooperativa/usuario/${u.id}`, "DELETE", undefined, "Usuário excluído com sucesso.");
  }
  return <Panel id="usuarios" title="Pessoas da cooperativa" description="Encontre produtores, acompanhe vínculos e gerencie sua equipe.">
    <div className="coop-filters"><Field label="Buscar pessoa"><input type="search" placeholder="Nome ou e-mail" value={busca} onChange={e => filtrar(setBusca, e.target.value)} /></Field><Field label="Perfil"><select value={tipo} onChange={e => filtrar(setTipo, e.target.value)}><option value="">Todos os perfis</option><option value="produtor">Produtores</option><option value="agronomo">Agrônomos</option></select></Field><Field label="Vínculo do produtor"><select value={status} onChange={e => filtrar(setStatus, e.target.value)}><option value="">Todos os vínculos</option><option value="vinculado">Com agrônomo</option><option value="pendente">Sem agrônomo</option></select></Field></div>
    <ResourceState resource={resource} retry={retry} empty={!filtrados.length} emptyText={usuarios.length ? "Nenhuma pessoa corresponde aos filtros. Ajuste sua busca." : "Nenhum usuário cadastrado. Comece em Novo usuário."}>
      <div className="coop-people">{filtrados.slice((page - 1) * 6, page * 6).map(u => <article className="coop-person" key={u.id}>
        {edicao?.id === u.id ? <form className="coop-edit" onSubmit={salvar}><Field label="Nome completo"><input required value={edicao.nome} onChange={e => setEdicao({ ...edicao, nome: e.target.value })} /></Field><Field label="E-mail"><input required type="email" value={edicao.email} onChange={e => setEdicao({ ...edicao, email: e.target.value })} /></Field><div className="coop-buttons"><button className="coop-btn" disabled={ocupado}>Salvar alterações</button><button type="button" className="coop-btn secondary" onClick={() => setEdicao(null)} disabled={ocupado}>Cancelar</button><button type="button" className="coop-btn secondary" onClick={() => editarSenha(u.id)} disabled={ocupado}>Alterar senha</button></div></form> : <><div className="coop-person-identity"><span className="coop-avatar" aria-hidden="true">{u.nome?.slice(0, 2).toUpperCase()}</span><div><strong>{u.nome}</strong><span>{u.email}</span></div></div><div className="coop-person-meta"><span className="coop-role">{u.tipo === "agronomo" ? "Agrônomo" : u.tipo === "produtor" ? "Produtor" : u.tipo}</span>{u.tipo === "produtor" && <span className={`coop-badge ${u.agronomoId ? "ok" : "atencao"}`}>{u.agronomoId ? agronomos.get(String(u.agronomoId)) || "Agrônomo vinculado" : "Sem agrônomo"}</span>}</div><div className="coop-buttons"><button className="coop-btn secondary" disabled={ocupado} onClick={() => setEdicao({ id: u.id, nome: u.nome || "", email: u.email || "" })} aria-label={`Editar ${u.nome}`}>Editar</button><button className="coop-btn danger" disabled={ocupado} onClick={() => excluir(u)} aria-label={`Excluir ${u.nome}`}>Excluir</button></div></>}
      </article>)}</div><Pagination page={page} pages={pages} total={filtrados.length} onChange={setPagina} />
    </ResourceState>
  </Panel>;
}
