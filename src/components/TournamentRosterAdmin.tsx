import { useState } from "react";
import type { FormEvent } from "react";
import { rawSupabase, supabase } from "../supabase";
import { PlayerFace, PlayerPicker } from "./PlayerIdentity";

type Player = { id: string; name: string; number: string };

export default function TournamentRosterAdmin({ tournament, teamId, players, enrolled, onRefresh }: {
  tournament: string; teamId: string; players: Player[]; enrolled: string[]; onRefresh: () => Promise<void>;
}) {
  const [existing, setExisting] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const available = players.filter((player) => !enrolled.includes(player.id));

  async function enroll(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage("");
    const { error } = await supabase!.rpc("sports_enroll_player", { tournament, player_id: existing });
    if (error) setMessage(error.message);
    else { setExisting(""); await onRefresh(); setMessage("Jugador inscrito en este torneo."); }
    setBusy(false);
  }
  async function remove(player: Player) {
    if (!window.confirm(`¿Retirar a ${player.name} de la plantilla actual de este torneo? Se conservarán sus partidos, valoraciones y titulares históricas; su ficha seguirá en el equipo.`)) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await rawSupabase!.rpc("multi_unenroll_player", { team: teamId, tournament, player_id: player.id });
      if (error) setMessage(error.message);
      else { await onRefresh(); setMessage(`${player.name} fue retirado de este torneo. Su historial se conserva.`); }
    } catch { setMessage("No se pudo actualizar la plantilla. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <><details className="roster-admin">
    <summary>＋ Agregar jugador al torneo</summary>
    <p>Inscribe jugadores ya creados en el equipo. La misma ficha puede participar en varios torneos.</p>
    {available.length > 0 && <form className="account-form roster-form" onSubmit={enroll}>
      <PlayerPicker label="Jugador del equipo" players={available} value={existing} onChange={setExisting} />
      <button disabled={busy || !existing}>Inscribir jugador existente</button>
    </form>}
    {available.length === 0 && <p>No hay más jugadores disponibles. Crea nuevas fichas en Plantilla.</p>}
    <p role="status">{message}</p>
  </details><details className="roster-admin"><summary>Gestionar jugadores del torneo</summary><p>Retirar a alguien conserva su ficha, partidos y valoraciones anteriores.</p>
    {players.filter(p => enrolled.includes(p.id)).map(p => <div className="account-request" key={p.id}><span className="player-identity"><PlayerFace id={p.id} />{p.name} · #{p.number}</span><button type="button" disabled={busy} onClick={() => void remove(p)}>Retirar del torneo</button></div>)}
    {!enrolled.length && <p>No hay jugadores inscritos.</p>}<p role="status">{message}</p>
  </details></>;
}

