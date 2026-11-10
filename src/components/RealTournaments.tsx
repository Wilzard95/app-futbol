import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { rawSupabase, supabase } from "../supabase";
import type { Team } from "./TeamSelector";

type Tournament = { id: string; name: string; format: number };
type SportsData = { role: string; tournaments: Tournament[] };
const client = supabase!;

export default function RealTournaments({ onAccount, team, teams, onSelectTeam }: { onAccount: () => void; team: Team | null; teams: Team[]; onSelectTeam: (team: Team) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SportsData | null>(null);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("6");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    let active = true;
    client.auth.getSession().then(({ data: auth }) => { if (active) { setSession(auth.session); setLoading(false); } });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    let active = true;
    setData(null);
    if (session) client.rpc("sports_data").then(({ data: result, error }) => {
      if (!active) return;
      if (error) setMessage("Necesitas una ficha aprobada para consultar los torneos.");
      else { setData(result as SportsData); setMessage(""); }
    });
    return () => { active = false; };
  }, [session?.user.id]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const { error } = await client.rpc("sports_create_tournament", { tournament_name: name, game_format: Number(format) });
      if (error) { setMessage(error.message); return; }
      setName("");
      const result = await client.rpc("sports_data");
      if (result.error) setMessage("Torneo creado. Recarga la página para actualizar la lista.");
      else { setData(result.data as SportsData); setMessage("Torneo creado. Ahora puedes inscribir sus jugadores en Plantilla."); }
    } catch { setMessage("No se pudo conectar. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  async function deleteTournament(tournament: Tournament) {
    if (!team || confirmation !== tournament.name) return;
    if (!window.confirm(`¿Eliminar definitivamente «${tournament.name}»? Se eliminarán sus partidos, acciones, valoraciones y titulares. Los jugadores permanecerán en el equipo.`)) return;
    setBusy(true); setMessage("");
    try {
      const result = await rawSupabase!.rpc("multi_delete_tournament", { team: team.id, tournament: tournament.id, confirmation });
      if (result.error) { setMessage(result.error.message); return; }
      setDeleting(null); setConfirmation("");
      const refreshed = await client.rpc("sports_data");
      if (refreshed.error) setMessage("Torneo eliminado. Recarga para actualizar la lista.");
      else { setData(refreshed.data as SportsData); setMessage("Torneo eliminado. Los jugadores permanecen en el equipo."); }
    } catch { setMessage("No se pudo conectar. Comprueba el torneo antes de intentarlo de nuevo."); }
    finally { setBusy(false); }
  }
  if (loading) return <section className="panel connected-panel">Cargando…</section>;
  if (!session) return <section className="panel connected-panel"><h2>Mis torneos</h2><p>Inicia sesión para consultar tus torneos.</p><button className="lab-primary-button" onClick={onAccount}>Ir a Mi cuenta</button></section>;
  if (!data) return <section className="panel connected-panel"><h2>Mis torneos</h2><p>{message || "Cargando torneos…"}</p><button className="text-button" onClick={onAccount}>Ir a Mi cuenta</button></section>;
  return <section className="panel connected-panel">
    <div className="section-heading"><div><h2>Mis torneos</h2><p>Los torneos en los que participa {team?.name}.</p></div></div>
    {data.role === "admin" && <details className="roster-admin"><summary>＋ Crear torneo</summary>
      <form className="account-form roster-form" onSubmit={create}>
        <label>Equipo participante<select value={team?.id ?? ""} onChange={e => { const next = teams.find(t => t.id === e.target.value); if (next) onSelectTeam(next); }}>{teams.filter(t => t.role === "admin").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Nombre del torneo<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Modalidad<select value={format} onChange={e => setFormat(e.target.value)}><option value="5">Fútbol 5</option><option value="6">Fútbol 6</option><option value="11">Fútbol 11</option></select></label>
        <button disabled={busy || !name.trim()}>Crear torneo</button>
      </form>
    </details>}
    <p role="status">{message}</p>
    <h3>Torneos del equipo</h3>
    {data.tournaments.length === 0 && <p>Aún no hay torneos.</p>}
    {data.tournaments.map(t => <div className="tournament-entry" key={t.id}><div className="account-request"><strong>{t.name}</strong><span>Fútbol {t.format}</span>{data.role === "admin" && <button type="button" className="tournament-delete-toggle" aria-expanded={deleting === t.id} onClick={() => { setDeleting(deleting === t.id ? null : t.id); setConfirmation(""); }}>Eliminar torneo</button>}</div>
      {deleting === t.id && <div className="delete-team-panel tournament-delete-panel"><div className="delete-team-warning"><strong>Esta acción es permanente.</strong><p>Se eliminarán los partidos, acciones, valoraciones, comentarios y titulares de este torneo. Los jugadores y sus cuentas seguirán en el equipo; los demás torneos no se modificarán.</p></div><label>Escribe <strong>{t.name}</strong> para confirmar<input value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></label><button type="button" className="delete-team-button" disabled={busy || confirmation !== t.name} onClick={() => void deleteTournament(t)}>Eliminar torneo definitivamente</button></div>}
    </div>)}
  </section>;
}
