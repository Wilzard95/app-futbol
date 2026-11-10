import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Shield } from "lucide-react";
import { rawSupabase } from "../supabase";

export type Team = { id: string; name: string; role: "admin" | "player"; playerId: string | null };

/** Used only after the multi-team backend has passed the cutover checks. */
export default function TeamSelector({ selected, onSelect, onAccount, onTeams }: {
  selected: string; onSelect: (team: Team | null) => void; onAccount: () => void; onTeams: (teams: Team[]) => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    void rawSupabase!.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data: { subscription } } = rawSupabase!.auth.onAuthStateChange((_event, value) => { if (active) setSession(value); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    let active = true;
    setTeams([]); onTeams([]);
    if (!session) { onSelect(null); return () => { active = false; }; }
    void rawSupabase!.rpc("multi_my_teams").then(async ({ data, error }) => {
      if (!active) return;
      if (error) { setMessage("No pudimos cargar tus equipos."); return; }
      let next = data as Team[];
      const invite = localStorage.getItem("la-cancha-invite");
      if (invite) {
        const response = await rawSupabase!.rpc("multi_invite_info", { invite_code: invite });
        if (!active) return;
        if (!response.error && response.data) {
          const info = response.data as { teamId: string; teamName: string };
          if (!next.some(t => t.id === info.teamId)) next = [...next, { id: info.teamId, name: info.teamName, role: "player", playerId: null }];
          setTeams(next); onTeams(next); onSelect(next.find(t => t.id === info.teamId) ?? null); return;
        }
      }
      setTeams(next); onTeams(next);
      onSelect(next.find(t => t.id === selected) ?? next[0] ?? null);
    });
    return () => { active = false; };
  }, [session?.user.id]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const result = await rawSupabase!.rpc("multi_create_team", { team_name: name.trim() });
      if (result.error) { setMessage(result.error.message); return; }
      const refreshed = await rawSupabase!.rpc("multi_my_teams");
      if (refreshed.error) { setMessage("El equipo se creó; recarga para verlo."); return; }
      const next = refreshed.data as Team[];
      setTeams(next); onTeams(next); onSelect(next.find(t => t.id === result.data) ?? null);
      setName(""); setCreating(false); setMessage("Equipo creado. Eres su administrador.");
    } catch { setMessage("No se pudo conectar. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <div className="team-switcher">
    <div className="team-card"><span className="team-crest"><Shield size={24} /></span>
      {session ? <label>Mi equipo<select aria-label="Seleccionar equipo" value={selected} onChange={e => onSelect(teams.find(t => t.id === e.target.value) ?? null)}>
        {!teams.length && <option value="">Sin equipos</option>}
        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select></label> : <button type="button" className="text-button" onClick={onAccount}>Inicia sesión para elegir equipo</button>}
    </div>
    {session && <><button type="button" className="text-button" aria-expanded={creating} onClick={() => setCreating(!creating)}>＋ Crear nuevo equipo</button>
      {creating && <form className="account-form" onSubmit={create}><label>Nombre del equipo<input value={name} onChange={e => setName(e.target.value)} maxLength={100} required /></label><button disabled={busy || !name.trim()}>Crear equipo</button></form>}</>}
    <p role="status">{message}</p>
  </div>;
}
