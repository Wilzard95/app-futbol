import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { rawSupabase } from "../supabase";
import { defaultAvatar } from "../domain/visuals";
import type { Visuals } from "../domain/visuals";
import AvatarFigure from "./AvatarFigure";

const VisualContext = createContext<Visuals | null>(null);
export function TeamVisualProvider({ teamId, children }: { teamId: string; children: ReactNode }) {
  const [visuals, setVisuals] = useState<Visuals | null>(null);
  useEffect(() => {
    let active = true; setVisuals(null);
    if (!teamId) return;
    const load = () => { void rawSupabase!.rpc("multi_visuals", { team: teamId }).then(async ({ data, error }) => {
      if (!active) return;
      if (!error) { setVisuals(data as Visuals); return; }
      const invite = localStorage.getItem("la-cancha-invite");
      if (!invite) return;
      const fallback = await rawSupabase!.rpc("multi_invite_visuals", { invite_code: invite });
      if (active && !fallback.error && (fallback.data as { teamId: string }).teamId === teamId) setVisuals(fallback.data as Visuals);
    }); };
    load(); const timer = window.setInterval(load, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [teamId]);
  return <VisualContext.Provider value={visuals}>{children}</VisualContext.Provider>;
}
export function useTeamVisuals() { return useContext(VisualContext); }
export function PlayerFace({ id, className = "" }: { id: string; className?: string }) {
  const visuals = useTeamVisuals();
  const value = visuals?.players[id];
  return <span className={`player-face ${className}`} aria-hidden="true"><AvatarFigure avatar={value?.avatar ?? defaultAvatar} photo={value?.photo} /></span>;
}
type Choice = { id: string; name: string; number: string; occupied?: boolean };
export function PlayerPicker({ label, players, value, onChange, disabled = false, unavailable = [] }: { label: string; players: Choice[]; value: string; onChange: (id: string) => void; disabled?: boolean; unavailable?: string[] }) {
  return <fieldset className="player-picker" disabled={disabled}><legend>{label}</legend>
    {players.length === 0 ? <p>No hay jugadores disponibles.</p> : <div className="player-picker-grid">{players.map(p => <button type="button" key={p.id} className="player-choice" aria-pressed={value === p.id} disabled={p.occupied || unavailable.includes(p.id)} onClick={() => onChange(value === p.id ? "" : p.id)}><PlayerFace id={p.id} /><span>{p.name}<small>#{p.number}{p.occupied ? " · ocupada" : ""}</small></span></button>)}</div>}
  </fieldset>;
}
