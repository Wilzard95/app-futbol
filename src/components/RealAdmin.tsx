import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../supabase";
import { eventRules } from "../domain/events";
import type { MatchEventKind } from "../domain/types";
import { PlayerFace, PlayerPicker } from "./PlayerIdentity";
type Player = { id: string; name: string; number: string };
type Game = {
  id: string;
  opponent: string;
  participants: string[];
  open: boolean;
};
type Tournament = { id: string; name: string };
const client = supabase!;
export default function RealAdmin({
  players,
  games,
  tournaments,
  roster,
  onRefresh,
}: {
  players: Player[];
  games: Game[];
  tournaments: Tournament[];
  roster: Record<string, string[]>;
  onRefresh: () => Promise<void>;
}) {
  const [tournament, setTournament] = useState(tournaments[0]?.id ?? "");
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState("");
  const [gf, setGf] = useState("0");
  const [ga, setGa] = useState("0");
  const [selected, setSelected] = useState<string[]>([]);
  const [match, setMatch] = useState(games[0]?.id ?? "");
  const [player, setPlayer] = useState("");
  const [kind, setKind] = useState<MatchEventKind>("goal");
  const [context, setContext] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const game = games.find((g) => g.id === match);
  async function createMatch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await client.rpc("sports_create_match", {
      tournament,
      opponent,
      played_on: date,
      goals_for: Number(gf),
      goals_against: Number(ga),
      participants: selected,
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Partido creado. Ya puedes registrar sus acciones.");
      setOpponent("");
      setSelected([]);
      await onRefresh();
      setMatch(String(data));
    }
    setBusy(false);
  }
  async function addEvent(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await client.rpc("sports_add_event", {
      match_id: match,
      player_id: player,
      kind,
      event_context: context,
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Acción registrada.");
      setContext("");
      await onRefresh();
    }
    setBusy(false);
  }
  async function openRatings() {
    setBusy(true);
    const { error } = await client.rpc("sports_open_ratings", {
      match_id: match,
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Valoraciones abiertas para este partido.");
      await onRefresh();
    }
    setBusy(false);
  }
  return (
    <details className="panel connected-panel">
      <summary>Agregar partido</summary>
      <p>Para inscribir jugadores en un torneo, abre Mis torneos y busca el torneo correspondiente.</p>
      <h3>Registrar partido</h3>
      <form className="account-form" onSubmit={createMatch}>
        <label>
          Torneo
          <select
            required
            value={tournament}
            onChange={(e) => { setTournament(e.target.value); setSelected([]); }}
          >
            <option value="">Selecciona torneo</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rival
          <input
            required
            maxLength={100}
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
          />
        </label>
        <label>
          Fecha
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Goles a favor
          <input
            type="number"
            min="0"
            max="99"
            required
            value={gf}
            onChange={(e) => setGf(e.target.value)}
          />
        </label>
        <label>
          Goles en contra
          <input
            type="number"
            min="0"
            max="99"
            required
            value={ga}
            onChange={(e) => setGa(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Jugadores participantes</legend>
          {players.filter((p) => (roster[tournament] ?? []).includes(p.id)).map((p) => (
            <label key={p.id}>
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, p.id]
                      : selected.filter((id) => id !== p.id),
                  )
                }
              />
              <PlayerFace id={p.id} /> {p.name} · #{p.number}
            </label>
          ))}
        </fieldset>
        <button disabled={busy || !tournament || selected.length === 0}>
          Guardar partido
        </button>
      </form>
      <h3>Registrar acción</h3>
      <p>Registra las acciones antes de abrir las valoraciones.</p>
      <form className="account-form" onSubmit={addEvent}>
        <label>
          Partido
          <select
            required
            value={match}
            onChange={(e) => {
              setMatch(e.target.value);
              setPlayer("");
            }}
          >
            <option value="">Selecciona partido</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                vs. {g.opponent}
              </option>
            ))}
          </select>
        </label>
        <PlayerPicker label="Jugador" players={players.filter(p => game?.participants.includes(p.id))} value={player} onChange={setPlayer} />
        <label>
          Acción
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MatchEventKind)}
          >
            {(Object.keys(eventRules) as MatchEventKind[]).map((k) => (
              <option key={k} value={k}>
                {eventRules[k].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contexto opcional
          <textarea
            maxLength={280}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </label>
        <button disabled={busy || !match || !player}>Registrar acción</button>
      </form>
      {game && !game.open && (
        <button
          className="lab-primary-button"
          disabled={busy}
          onClick={() => void openRatings()}
        >
          Abrir valoraciones del partido
        </button>
      )}
      <p role="status">{message}</p>
    </details>
  );
}

