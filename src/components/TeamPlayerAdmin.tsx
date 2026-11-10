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
  async function deletePlayer(player: Player) {
    if (!window.confirm(`¿Eliminar definitivamente la ficha de ${player.name}? Se quitará de todos los torneos y se desvinculará su cuenta. Solo se puede eliminar si no tiene historial de partidos ni titulares.`)) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await rawSupabase!.rpc("multi_delete_unused_player", { team: teamId, player_id: player.id });
      if (error) setMessage(error.message);
      else { await onRefresh(); setMessage(`La ficha de ${player.name} se eliminó definitivamente.`); }
    } catch { setMessage("No se pudo eliminar la ficha. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <details className="roster-admin"><summary>Gestionar jugadores del equipo</summary>
    <p>Puedes retirar una ficha conservando su historial o eliminarla definitivamente si no tiene partidos ni titulares. Ambas acciones desvinculan su cuenta de jugador.</p>
    {players.map(player => <div className="account-request" key={player.id}><span className="player-identity"><PlayerFace id={player.id} />{player.name} · #{player.number}{player.retiredFromTeam ? " · retirado" : ""}</span>{!player.retiredFromTeam && <button type="button" disabled={busy} onClick={() => void remove(player)}>Retirar del equipo</button>}<button type="button" disabled={busy} onClick={() => void deletePlayer(player)}>Eliminar ficha</button></div>)}
    {players.length === 0 && <p>No hay fichas de jugadores.</p>}<p role="status">{message}</p>
  </details>;
}

