import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../supabase";
import { PlayerPicker } from "./PlayerIdentity";

type Player = { id: string; name: string; number: string };

export default function TournamentRosterAdmin({ tournament, players, enrolled, onRefresh }: {
  tournament: string; players: Player[]; enrolled: string[]; onRefresh: () => Promise<void>;
}) {
  const [existing, setExisting] = useState("");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState("Volante");
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
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage("");
    const { error } = await supabase!.rpc("sports_create_roster_player", { tournament, player_name: name, shirt_number: number, player_position: position });
    if (error) setMessage(error.message);
    else { setName(""); setNumber(""); await onRefresh(); setMessage("Jugador creado e inscrito en este torneo."); }
    setBusy(false);
  }
  return <details className="roster-admin">
    <summary>＋ Agregar jugador al torneo</summary>
    <p>Inscriba una ficha existente o cree una nueva. La misma ficha puede participar en varios torneos.</p>
    {available.length > 0 && <form className="account-form roster-form" onSubmit={enroll}>
      <PlayerPicker label="Jugador del equipo" players={available} value={existing} onChange={setExisting} />
      <button disabled={busy || !existing}>Inscribir jugador existente</button>
    </form>}
    <h3>Crear ficha nueva</h3>
    <form className="account-form roster-form" onSubmit={create}>
      <label>Nombre<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Dorsal<input required maxLength={5} value={number} onChange={e => setNumber(e.target.value)} /></label>
      <label>Posición<select value={position} onChange={e => setPosition(e.target.value)}>
        <option>Portero</option><option>Defensa</option><option>Volante</option><option>Delantero</option>
      </select></label>
      <button disabled={busy || !tournament}>Crear e inscribir jugador</button>
    </form>
    <p role="status">{message}</p>
  </details>;
}
