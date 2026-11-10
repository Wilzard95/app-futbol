import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Camera, ImagePlus, Shield } from "lucide-react";
import { rawSupabase } from "../supabase";
import { prepareImage } from "../domain/visuals";
import type { Visuals } from "../domain/visuals";

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
  const [crest, setCrest] = useState<string | null>(null);
  const [crestOpen, setCrestOpen] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const canEditCrest = !!session && teams.find(t => t.id === selected)?.role === "admin";

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
  useEffect(() => {
    let active = true; setCrest(null); setCrestOpen(false);
    if (selected && session) void rawSupabase!.rpc("multi_visuals", { team: selected }).then(({ data, error }) => { if (active && !error) setCrest((data as Visuals).crest); });
    return () => { active = false; };
  }, [selected, session?.user.id]);
  async function uploadCrest(file?: File) {
    if (!file || !selected) return;
    const targetTeam = selected;
    setBusy(true); setMessage("");
    try {
      const image = await prepareImage(file);
      const { error } = await rawSupabase!.rpc("multi_set_crest", { team: targetTeam, image });
      if (selectedRef.current !== targetTeam) return;
      if (error) setMessage(error.message); else { setCrest(image); setCrestOpen(false); setMessage("Escudo actualizado."); }
    } catch (e) { setMessage(e instanceof Error ? e.message : "No se pudo subir el escudo."); }
    finally { setBusy(false); }
  }
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
    <div className="team-card">{canEditCrest ? <button type="button" className="team-crest team-crest-button" aria-label="Cambiar escudo del equipo" aria-expanded={crestOpen} aria-controls="crest-editor" onClick={() => setCrestOpen(!crestOpen)}>{crest ? <img src={crest} alt="" /> : <Shield size={24} />}<span className="crest-camera"><Camera size={10} /></span></button> : <span className="team-crest">{crest ? <img src={crest} alt="Escudo del equipo" /> : <Shield size={24} />}</span>}
      {session ? <label>Mi equipo<select aria-label="Seleccionar equipo" value={selected} onChange={e => onSelect(teams.find(t => t.id === e.target.value) ?? null)}>
        {!teams.length && <option value="">Sin equipos</option>}
        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select></label> : <button type="button" className="text-button" onClick={onAccount}>Inicia sesión para elegir equipo</button>}
    </div>
    {canEditCrest && crestOpen && <div className="crest-editor" id="crest-editor"><div className="crest-editor-heading"><span className="crest-editor-icon"><ImagePlus size={17} /></span><div><strong>Escudo del equipo</strong><p>Elige una imagen para identificar a tu equipo.</p></div></div><label className="crest-file-button">{busy ? "Subiendo…" : "Elegir imagen"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void uploadCrest(file); }} /></label><small>JPG, PNG o WebP · hasta 8 MB</small></div>}
    {session && <><button type="button" className="text-button" aria-expanded={creating} onClick={() => setCreating(!creating)}>＋ Crear nuevo equipo</button>
      {creating && <form className="account-form" onSubmit={create}><label>Nombre del equipo<input value={name} onChange={e => setName(e.target.value)} maxLength={100} required /></label><button disabled={busy || !name.trim()}>Crear equipo</button></form>}</>}
    <p role="status">{message}</p>
  </div>;
}
