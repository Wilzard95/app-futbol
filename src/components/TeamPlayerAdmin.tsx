import { useState } from "react";
import { rawSupabase } from "../supabase";
import { PlayerFace } from "./PlayerIdentity";

type Player = { id: string; name: string; number: string; retiredFromTeam?: boolean };
export default function TeamPlayerAdmin({ teamId, players, onRefresh }: { teamId: string; players: Player[]; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function remove(player: Player) {
    if (!window.confirm(`¿Retirar a ${player.name} del equipo? Saldrá de todos sus torneos, se desvinculará su ficha y se conservará su historial de partidos y valoraciones.`)) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await rawSupabase!.rpc("multi_retire_team_player", { team: teamId, player_id: player.id });
      if (error) setMessage(error.message);
      else { await onRefresh(); setMessage(`${player.name} fue retirado del equipo. Su historial se conserva.`); }
    } catch { setMessage("No se pudo actualizar el equipo. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  const active = players.filter(p => !p.retiredFromTeam);
  return <details className="roster-admin"><summary>Gestionar jugadores del equipo</summary>
    <p>Retirar una ficha la quita de todos los torneos y conserva su historial. Si tiene una cuenta vinculada, se desvinculará del jugador.</p>
    {active.map(player => <div className="account-request" key={player.id}><span className="player-identity"><PlayerFace id={player.id} />{player.name} · #{player.number}</span><button type="button" disabled={busy} onClick={() => void remove(player)}>Retirar del equipo</button></div>)}
    {active.length === 0 && <p>No hay jugadores activos.</p>}<p role="status">{message}</p>
  </details>;
}

