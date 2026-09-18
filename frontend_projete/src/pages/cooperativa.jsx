import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_API_URL } from "../config/api";
import { fetchAutenticado } from "../services/apiAutenticado";
import useCooperativa, { requisitarCooperativa } from "../hooks/useCooperativa";
import { Field, Icon, Pagination, Panel, ResourceState } from "../components/cooperativa/CoopUI";
import UsuariosPanel from "../components/cooperativa/UsuariosPanel";
import "./cooperativa.css";

const ROTULOS = { ok: "Saudável", atencao: "Atenção", critico: "Crítico" };
const CADASTRO_INICIAL = { nome: "", email: "", senha: "", tipo: "produtor" };
const AVISO_INICIAL = { titulo: "", mensagem: "", destinatarioTipo: "todos" };
function Cooperativa() {
  const navigate = useNavigate();
  const dados = useCooperativa();
  const [aba, setAba] = useState("visao");
  const [feedback, setFeedback] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const bloqueio = useRef(false);
  const [exportando, setExportando] = useState(false);
  const exportacao = useRef(false);
  const [cadastro, setCadastro] = useState(CADASTRO_INICIAL);
  const [vinculo, setVinculo] = useState({ produtorId: "", agronomoId: "" });
  const [aviso, setAviso] = useState(AVISO_INICIAL);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [pagina, setPagina] = useState(1);
  const usuarios = dados.usuarios.dados || [];
  const dashboard = dados.dashboard.dados;
  const ranking = dados.ranking.dados || [];
  const produtores = usuarios.filter(u => u.tipo === "produtor");
  const agronomos = usuarios.filter(u => u.tipo === "agronomo");
  const alertas = (Array.isArray(dashboard?.lavourasEmAlerta) ? dashboard.lavourasEmAlerta : []).filter(l => (!status || l.status === status) && `${l.nomeLavoura} ${l.produtor}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const paginas = Math.max(1, Math.ceil(alertas.length / 5));
  const atual = Math.min(pagina, paginas);
  const nome = localStorage.getItem("usuarioNome")?.trim().split(/\s+/)[0];
  const selecionado = produtores.find(p => String(p.id) === vinculo.produtorId);
  async function executar(caminho, method, body, sucesso) {
    if (bloqueio.current) return false;
    bloqueio.current = true; setOcupado(true); setFeedback(null);
    try {
      await requisitarCooperativa(caminho, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
      setFeedback({ tipo: "success", texto: sucesso });
      await dados.atualizar();
      return true;
    } catch (erro) { setFeedback({ tipo: "error", texto: erro.message || "Não foi possível conectar ao servidor." }); return false; }
    finally { bloqueio.current = false; setOcupado(false); }
  }
  async function cadastrar(e) {
    e.preventDefault();
    if (!cadastro.nome.trim()) return;
    if (await executar("/cooperativa/cadastrar-usuario", "POST", { ...cadastro, nome: cadastro.nome.trim(), email: cadastro.email.trim() }, "Usuário cadastrado com sucesso.")) setCadastro(CADASTRO_INICIAL);
  }
  async function vincular(e) {
    e.preventDefault();
    if (await executar("/vincular", "POST", vinculo, "Produtor vinculado ao agrônomo com sucesso.")) setVinculo({ produtorId: "", agronomoId: "" });
  }
  async function desvincular() {
    if (!selecionado || !window.confirm(`Remover o vínculo de ${selecionado.nome} com seu agrônomo?`)) return;
    if (await executar("/desvincular", "POST", { produtorId: vinculo.produtorId }, "Vínculo removido com sucesso.")) setVinculo({ produtorId: "", agronomoId: "" });
  }
  async function enviarAviso(e) {
    e.preventDefault();
    if (!aviso.titulo.trim() || !aviso.mensagem.trim()) return;
    if (await executar("/cooperativa/avisos", "POST", { ...aviso, titulo: aviso.titulo.trim(), mensagem: aviso.mensagem.trim() }, "Aviso enviado com sucesso aos destinatários selecionados.")) setAviso(AVISO_INICIAL);
  }
  async function baixarRelatorio() {
    if (exportacao.current) return;
    exportacao.current = true; setExportando(true); setFeedback(null);
    try {
      const resposta = await fetchAutenticado(`${AUTH_API_URL}/cooperativa/relatorio.csv`);
      if (!resposta.ok) throw new Error("Não foi possível gerar o relatório. Tente novamente.");
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement("a"); link.href = url; link.download = "relatorio_coffeevision.csv";
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback({ tipo: "success", texto: "Relatório gerado. O download foi iniciado." });
    } catch (erro) { setFeedback({ tipo: "error", texto: erro.message }); }
    finally { exportacao.current = false; setExportando(false); }
  }
  function abrir(secao, id) {
    setAba(secao);
    requestAnimationFrame(() => { const destino = document.getElementById(id || "coop-content"); destino?.scrollIntoView({ block: "start" }); destino?.querySelector("input, select, textarea")?.focus({ preventScroll: true }); });
  }
  const tabs = [["visao", "Visão geral", "grid"], ["pessoas", "Pessoas e vínculos", "users"], ["avisos", "Comunicados", "bell"]];
  return <div className="cooperativa-page">
    <a className="coop-skip" href="#coop-content">Ir para o conteúdo</a>
    <header className="coop-topbar"><a href="/cooperativa" className="coop-brand"><span className="coop-logo"><Icon /></span><span>CoffeeVision<small>PAINEL DA COOPERATIVA</small></span></a><button className="coop-profile" onClick={() => navigate("/perfil")}><span className="coop-avatar">{nome?.slice(0, 2).toUpperCase() || "CO"}</span><span>Meu perfil</span></button></header>
    <main className="coop-main">
      <section className="coop-hero"><div><span className="coop-eyebrow">GESTÃO CONECTADA AO CAMPO</span><h1>Olá{nome ? `, ${nome}` : ""}. Vamos cultivar resultados?</h1><p>Sua equipe, suas lavouras e as prioridades do dia em um só lugar.</p><div className="coop-hero-actions"><button className="coop-btn light" onClick={() => abrir("pessoas", "cadastro")}><Icon name="plus" />Novo usuário</button><button className="coop-btn outline" disabled={exportando} onClick={baixarRelatorio}><Icon name="download" />{exportando ? "Gerando…" : "Exportar relatório"}</button></div></div><div className="coop-hero-art" aria-hidden="true"><Icon width="140" height="140" /><span>Crescer, juntos.</span></div></section>
      <div className="coop-overview-heading"><h2>Um olhar sobre a cooperativa</h2><button className="coop-btn text" disabled={Object.values({ u: dados.usuarios, d: dados.dashboard, r: dados.ranking }).some(r => r.carregando) || ocupado} onClick={dados.atualizar}><Icon name="refresh" />Atualizar</button></div>
      <ResourceState resource={dados.dashboard} retry={() => dados.carregar("dashboard")}><div className="coop-stats">{[["Produtores", "totalProdutores", "users", "Sua rede no campo"], ["Agrônomos", "totalAgronomos", "leaf", "Equipe técnica"], ["Lavouras", "totalLavouras", "grid", "Áreas cadastradas"], ["Sem agrônomo", "produtoresSemAgronomo", "alert", "Produtores a direcionar"]].map(([label, key, icon, hint]) => <div className={`coop-stat ${key === "produtoresSemAgronomo" ? "warm" : ""}`} key={key}><span className="coop-stat-icon"><Icon name={icon} /></span><span>{label}</span><strong>{dashboard?.[key] ?? "—"}</strong><small>{hint}</small></div>)}</div></ResourceState>
      <div className="coop-tabs" role="tablist" aria-label="Seções da cooperativa">{tabs.map(([key, label, icon], index) => <button key={key} id={`tab-${key}`} role="tab" aria-selected={aba === key} aria-controls="coop-content" tabIndex={aba === key ? 0 : -1} onClick={() => setAba(key)} onKeyDown={e => { const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (step || e.key === "Home" || e.key === "End") { e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + step + tabs.length) % tabs.length; setAba(tabs[next][0]); document.getElementById(`tab-${tabs[next][0]}`)?.focus(); } }}><Icon name={icon} />{label}</button>)}</div>
      {feedback && <div className={`coop-feedback ${feedback.tipo}`} role={feedback.tipo === "error" ? "alert" : "status"}><Icon name={feedback.tipo === "error" ? "alert" : "check"} /><p>{feedback.texto}</p><button className="coop-btn text" onClick={() => setFeedback(null)} aria-label="Fechar mensagem">×</button></div>}
      <div id="coop-content" role="tabpanel" aria-labelledby={`tab-${aba}`} tabIndex={0}>
        {aba === "visao" && <><div className="coop-quick">{[["pessoas", "cadastro", "plus", "Cadastrar pessoa", "Amplie sua rede de produtores e agrônomos"], ["pessoas", "vinculos", "link", "Direcionar produtor", "Conecte o campo à assistência técnica"], ["avisos", "comunicados", "bell", "Enviar comunicado", "Mantenha a cooperativa informada"]].map(([secao, id, icon, title, text]) => <button key={id} onClick={() => abrir(secao, id)}><span className="coop-quick-icon"><Icon name={icon} /></span><span><strong>{title}</strong><small>{text}</small></span><Icon name="arrow" /></button>)}</div>
          <div className="coop-dashboard-grid"><Panel id="lavouras" title="Lavouras em atenção" description="Priorize o acompanhamento das áreas sinalizadas."><ResourceState resource={dados.dashboard} retry={() => dados.carregar("dashboard")}>
            <div className="coop-status-summary">{Object.entries(ROTULOS).map(([key, label]) => <span className={`coop-badge ${key}`} key={key}>{label}: {dashboard?.statusLavouras?.[key] ?? "—"}</span>)}</div>
            <div className="coop-filters compact"><Field label="Buscar lavoura ou produtor"><input type="search" value={busca} placeholder="Digite um nome" onChange={e => { setBusca(e.target.value); setPagina(1); }} /></Field><Field label="Situação"><select value={status} onChange={e => { setStatus(e.target.value); setPagina(1); }}><option value="">Todas</option><option value="atencao">Atenção</option><option value="critico">Crítico</option></select></Field></div>
            {alertas.length ? <><div className="coop-alert-list">{alertas.slice((atual - 1) * 5, atual * 5).map(l => <div className="coop-alert-row" key={l.id}><span className={`coop-dot ${l.status}`} /><div><strong>{l.nomeLavoura}</strong><small>{l.produtor || "Produtor não informado"}</small></div><span className={`coop-badge ${l.status}`}>{ROTULOS[l.status] || "Não informado"}</span></div>)}</div><Pagination page={atual} pages={paginas} total={alertas.length} onChange={setPagina} /></> : <div className="coop-empty"><Icon name="check" /><p>{busca || status ? "Nenhuma lavoura corresponde aos filtros." : "Nenhuma lavoura em alerta no momento."}</p></div>}
          </ResourceState></Panel><Panel id="ranking" title="Acompanhamento técnico" description="Distribuição de produtores e lavouras por agrônomo."><ResourceState resource={dados.ranking} retry={() => dados.carregar("ranking")} empty={!ranking.length} emptyText="O acompanhamento aparecerá quando houver agrônomos cadastrados."><div className="coop-table-scroll" tabIndex={0} role="region" aria-label="Ranking de agrônomos"><table className="coop-table"><caption className="coop-sr-only">Produtores, lavouras e lavouras críticas por agrônomo</caption><thead><tr><th scope="col">Agrônomo</th><th scope="col">Produtores</th><th scope="col">Lavouras</th><th scope="col">Críticas</th></tr></thead><tbody>{ranking.map(r => <tr key={r.id}><th scope="row">{r.nome}</th><td>{r.totalProdutores ?? "—"}</td><td>{r.totalLavouras ?? "—"}</td><td><span className={`coop-badge ${Number(r.lavourasCriticas) > 0 ? "critico" : "ok"}`}>{r.lavourasCriticas ?? "—"}</span></td></tr>)}</tbody></table></div></ResourceState></Panel></div></>}
        {aba === "pessoas" && <><div className="coop-form-grid"><Panel id="cadastro" title="Novo usuário" description="Cadastre quem faz parte da sua cooperativa."><form className="coop-form" onSubmit={cadastrar}><fieldset disabled={ocupado}><Field label="Nome completo"><input autoComplete="name" required value={cadastro.nome} onChange={e => setCadastro({ ...cadastro, nome: e.target.value })} /></Field><Field label="E-mail"><input autoComplete="email" type="email" required value={cadastro.email} onChange={e => setCadastro({ ...cadastro, email: e.target.value })} /></Field><Field label="Senha provisória"><input autoComplete="new-password" type="password" required value={cadastro.senha} onChange={e => setCadastro({ ...cadastro, senha: e.target.value })} /></Field><Field label="Perfil de acesso"><select value={cadastro.tipo} onChange={e => setCadastro({ ...cadastro, tipo: e.target.value })}><option value="produtor">Produtor</option><option value="agronomo">Agrônomo</option></select></Field><button className="coop-btn" type="submit"><Icon name="plus" />{ocupado ? "Aguarde…" : "Cadastrar usuário"}</button></fieldset></form></Panel>
          <Panel id="vinculos" title="Vínculo técnico" description="Defina o agrônomo responsável por cada produtor."><ResourceState resource={dados.usuarios} retry={() => dados.carregar("usuarios")}><form className="coop-form" onSubmit={vincular}><fieldset disabled={ocupado || !produtores.length}><Field label="Produtor"><select required value={vinculo.produtorId} onChange={e => setVinculo({ ...vinculo, produtorId: e.target.value })}><option value="">Selecione um produtor</option>{produtores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Field><Field label="Agrônomo responsável"><select required value={vinculo.agronomoId} onChange={e => setVinculo({ ...vinculo, agronomoId: e.target.value })}><option value="">Selecione um agrônomo</option>{agronomos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field><p className="coop-hint">{selecionado ? selecionado.agronomoId ? `Responsável atual: ${agronomos.find(a => String(a.id) === String(selecionado.agronomoId))?.nome || "Agrônomo vinculado"}. Salvar substitui o vínculo atual.` : "Este produtor ainda não tem agrônomo responsável." : "Selecione um produtor para consultar seu vínculo atual."}</p><div className="coop-buttons"><button className="coop-btn" disabled={!vinculo.produtorId || !vinculo.agronomoId}><Icon name="link" />Salvar vínculo</button><button type="button" className="coop-btn danger" disabled={!selecionado?.agronomoId} onClick={desvincular}>Remover vínculo</button></div></fieldset>{(!produtores.length || !agronomos.length) && <p className="coop-hint">Cadastre produtores e agrônomos para criar vínculos.</p>}</form></ResourceState></Panel></div>
          <UsuariosPanel resource={dados.usuarios} retry={() => dados.carregar("usuarios")} executar={executar} ocupado={ocupado} editarSenha={id => { localStorage.setItem("editarSenhaUsuarioId", id); navigate("/editar_senha"); }} /></>}
        {aba === "avisos" && <div className="coop-notice-grid"><Panel id="comunicados" title="Novo comunicado" description="Compartilhe orientações com as pessoas certas."><form className="coop-form" onSubmit={enviarAviso}><fieldset disabled={ocupado}><Field label="Destinatários"><select value={aviso.destinatarioTipo} onChange={e => setAviso({ ...aviso, destinatarioTipo: e.target.value })}><option value="todos">Todos</option><option value="produtores">Somente produtores</option><option value="agronomos">Somente agrônomos</option></select></Field><Field label="Título do comunicado"><input required value={aviso.titulo} placeholder="Ex.: Orientações para a próxima safra" onChange={e => setAviso({ ...aviso, titulo: e.target.value })} /></Field><Field label="Mensagem"><textarea required rows={6} value={aviso.mensagem} placeholder="Escreva uma orientação clara e objetiva…" onChange={e => setAviso({ ...aviso, mensagem: e.target.value })} /></Field><button className="coop-btn"><Icon name="bell" />{ocupado ? "Enviando…" : "Enviar comunicado"}</button></fieldset></form></Panel><aside className="coop-notice-preview"><span className="coop-eyebrow">PRÉVIA DO COMUNICADO</span><span className="coop-badge ok">{aviso.destinatarioTipo === "todos" ? "Todos" : aviso.destinatarioTipo === "produtores" ? "Produtores" : "Agrônomos"}</span><h2>{aviso.titulo || "Seu título aparece aqui"}</h2><p>{aviso.mensagem || "Confira a mensagem antes de enviar para sua cooperativa."}</p><small>O envio acontece ao clicar em “Enviar comunicado”.</small></aside></div>}
      </div><footer className="coop-footer"><Icon />CoffeeVision · Conectando pessoas e campo</footer>
    </main><nav className="coop-mobile-nav" aria-label="Navegação principal"><button aria-current="page" onClick={() => abrir("visao")}><Icon name="grid" />Gestão</button><button onClick={() => navigate("/perfil")}><Icon name="users" />Perfil</button></nav>
  </div>;
}
export default Cooperativa;
