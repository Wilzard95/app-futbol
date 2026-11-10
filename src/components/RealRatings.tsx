import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { eventRules } from "../domain/events";
import RealAdmin from "./RealAdmin";
import type { MatchEventKind } from "../domain/types";
import { PlayerFace, PlayerPicker } from "./PlayerIdentity";

type Player = { id: string; name: string; number: string };
type Event = {
  id: string;
  playerId: string;
  kind: MatchEventKind;
  context: string;
};
type Game = {
  id: string;
  tournamentId: string;
  opponent: string;
  playedAt: string | null;
  goalsFor: number;
  goalsAgainst: number;
  closed: boolean;
  open: boolean;
  participants: string[];
  events: Event[];
};
type Data = {
  myPlayer: string | null;
  role: string;
  roster: Record<string, string[]>;
  players: Player[];
  tournaments: { id: string; name: string }[];
  matches: Game[];
};
type Result = {
  playerId: string;
  average: number;
  count: number;
  comments: string[];
  approvals: number;
  disapprovals: number;
};
type Own = {
  score: number;
  adjustments: { eventId: string; value: number }[];
  comment: string;
  reaction: string | null;
};
const client = supabase!;
const eventIcons: Record<MatchEventKind, string> = {
  goal: "⚽",
  assist: "👟",
  yellow_card: "🟨",
  red_card: "🟥",
  clean_sheet: "🧤",
};

export default function RealRatings({ onAccount }: { onAccount: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [gameId, setGameId] = useState("");
  const [target, setTarget] = useState("");
  const [score, setScore] = useState("");
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [reaction, setReaction] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoaded(true);
      }
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_e, s) => {
      if (active) {
        setSession(s);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setData(null);
    if (!session) return;
    const load = (initial: boolean) =>
      client.rpc("sports_data").then(({ data, error }) => {
        if (!active) return;
        if (error) {
          if (initial || error.message.includes("Sin acceso")) {
            setData(null);
            setMessage(
              "Tu cuenta necesita una ficha aprobada para acceder a los partidos.",
            );
          }
          return;
        }
        const next = data as Data;
        setData(next);
        setGameId((current) =>
          next.matches.some((game) => game.id === current)
            ? current
            : (next.matches[0]?.id ?? ""),
        );
        if (initial) setMessage("");
      });
    void load(true);
    const timer = window.setInterval(() => void load(false), 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session?.user.id]);
  const game = data?.matches.find((g) => g.id === gameId);
  const canRate =
    !!game &&
    !!data?.myPlayer &&
    game.participants.includes(data.myPlayer) &&
    game.open &&
    !game.closed;
  const targetEvents = game?.events.filter((e) => e.playerId === target) ?? [];
  async function refreshSports() {
    const result = await client.rpc("sports_data");
    if (result.error) throw result.error;
    setData(result.data as Data);
  }
  useEffect(() => {
    setTarget("");
    setResults([]);
    if (!gameId || !session) return;
    let active = true;
    const load = () => {
      client
        .rpc("rating_results", { match_id: gameId })
        .then(({ data, error }) => {
          if (active && !error) setResults(data as Result[]);
        });
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [gameId, session?.user.id]);
  useEffect(() => {
    let active = true;
    setScore("");
    setAdjustments({});
    setComment("");
    setReaction("");
    if (!gameId || !target || !canRate) return;
    client
      .rpc("rating_mine", { match_id: gameId, target })
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        const own = data as Own;
        setScore(String(own.score));
        setAdjustments(
          Object.fromEntries(own.adjustments.map((a) => [a.eventId, a.value])),
        );
        setComment(own.comment);
        setReaction(own.reaction ?? "");
      });
    return () => {
      active = false;
    };
  }, [gameId, target, canRate]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!game || !target) return;
    setBusy(true);
    setMessage("");
    const payload = targetEvents.map((ev) => ({
      eventId: ev.id,
      value: adjustments[ev.id] ?? 0,
    }));
    const { error } = await client.rpc("rating_submit", {
      match_id: game.id,
      target,
      score: Number(score),
      adjustments: payload,
      comment: comment.trim(),
      reaction: reaction || null,
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Tu valoración se guardó.");
      const r = await client.rpc("rating_results", { match_id: game.id });
      if (!r.error) setResults(r.data as Result[]);
    }
    setBusy(false);
  }
  if (!loaded)
    return <section className="panel connected-panel">Cargando…</section>;
  if (!session)
    return (
      <section className="panel connected-panel">
        <h2>Valoraciones del equipo</h2>
        <p>Entra con tu cuenta vinculada para ver los partidos y valorar.</p>
        <button className="lab-primary-button" onClick={onAccount}>
          Ir a Mi cuenta
        </button>
      </section>
    );
  if (!data)
    return (
      <section className="panel connected-panel">
        <h2>Valoraciones del equipo</h2>
        <p>{message || "Cargando partidos…"}</p>
        <button className="text-button" onClick={onAccount}>
          Ir a Mi cuenta
        </button>
      </section>
    );
  return (
    <section className="panel connected-panel">
      <div className="section-heading">
        <div>
          <h2>
            Valoraciones del equipo <span>CUENTAS REALES</span>
          </h2>
          <p>
            Las valoraciones se guardan y los resultados se actualizan
            automáticamente.
          </p>
        </div>
      </div>
      {data.role === "admin" && (
        <RealAdmin
          players={data.players}
          games={data.matches}
          tournaments={data.tournaments}
          roster={data.roster}
          onRefresh={refreshSports}
        />
      )}
      <div className="account-form match-rating-pickers">
        <label>
          Partido
          <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
            {data.matches.map((g) => (
              <option key={g.id} value={g.id}>
                {g.playedAt} · vs. {g.opponent} · {g.goalsFor}–{g.goalsAgainst}
              </option>
            ))}
          </select>
        </label>
        <PlayerPicker label="Jugador a valorar" players={data.players.filter(p => game?.participants.includes(p.id))} value={target} onChange={setTarget} disabled={!canRate} />
      </div>
      {game && (
        <>
          <p>
            {data.tournaments.find((t) => t.id === game.tournamentId)?.name} ·{" "}
            {game.participants.length} participantes
          </p>
          {canRate && target ? (
            <form className="account-form" onSubmit={submit}>
              {target && (
                <>
                  <label>
                    Nota general (1 a 10)
                    <input
                      required
                      type="number"
                      min="1"
                      max="10"
                      step="0.1"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                    />
                  </label>
                  {targetEvents.map((ev) => (
                    <label key={ev.id}>
                      <span><span aria-hidden="true">{eventIcons[ev.kind]} </span>{eventRules[ev.kind].label}</span>
                      {ev.context && ` · ${ev.context}`}{" "}
                      <strong>{(adjustments[ev.id] ?? 0).toFixed(1)}</strong>
                      <input
                        type="range"
                        min={eventRules[ev.kind].min}
                        max={eventRules[ev.kind].max}
                        step="0.1"
                        value={adjustments[ev.id] ?? 0}
                        onChange={(e) =>
                          setAdjustments({
                            ...adjustments,
                            [ev.id]: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Comentario anónimo (opcional)
                    <textarea
                      maxLength={500}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </label>
                  <fieldset className="reaction-picker">
                    <legend>Reacción (opcional)</legend>
                    <div className="reaction-options">
                      <button type="button" className="reaction-button" aria-label="Aprobación" aria-pressed={reaction === "approve"} onClick={() => setReaction(reaction === "approve" ? "" : "approve")}>👍</button>
                      <button type="button" className="reaction-button" aria-label="Desaprobación" aria-pressed={reaction === "disapprove"} onClick={() => setReaction(reaction === "disapprove" ? "" : "disapprove")}>👎</button>
                    </div>
                    <small>Pulsa de nuevo para quitar tu reacción.</small>
                  </fieldset>
                  <button disabled={busy || !score}>Guardar valoración</button>
                </>
              )}
            </form>
          ) : !canRate ? (
            <p>
              {!game.open
                ? "El administrador todavía no ha abierto las valoraciones."
                : game.closed
                  ? "La valoración de este partido está cerrada."
                  : "Tu ficha no participó en este partido."}
            </p>
          ) : <p>Selecciona un jugador arriba para valorar su partido.</p>}
          <p role="status">{message}</p>
          <h3>Promedios de este partido</h3>
          <div className="table-scroll">
            <table className="player-table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Promedio</th>
                  <th>Valoraciones</th>
                </tr>
              </thead>
              <tbody>
                {data.players
                  .filter((player) => game.participants.includes(player.id))
                  .sort((a, b) => {
                    const aResult = results.find((item) => item.playerId === a.id);
                    const bResult = results.find((item) => item.playerId === b.id);
                    if (!aResult && bResult) return 1;
                    if (aResult && !bResult) return -1;
                    return (Number(bResult?.average ?? 0) - Number(aResult?.average ?? 0)) || a.name.localeCompare(b.name, "es");
                  })
                  .map((player) => {
                    const result = results.find(
                      (item) => item.playerId === player.id,
                    );
                    return (
                      <tr key={player.id}>
                        <td>
                          <span className="player-identity"><PlayerFace id={player.id} />{player.name} · #{player.number}</span>
                        </td>
                        <td>
                          {result ? Number(result.average).toFixed(2) : "—"}
                        </td>
                        <td>{result?.count ?? 0}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Acciones registradas ({game.events.length})</summary>
            {game.events.length === 0 && <p>No hay acciones registradas.</p>}
            {game.events.map((ev) => (
              <div className="match-action" key={ev.id}>
                <span className={`match-action-icon ${ev.kind}`} aria-hidden="true">{eventIcons[ev.kind]}</span>
                <div>
                  <strong>{eventRules[ev.kind].label}</strong>
                  <p><span className="player-identity"><PlayerFace id={ev.playerId} />{data.players.find((p) => p.id === ev.playerId)?.name}</span>{ev.context ? ` · ${ev.context}` : ""}</p>
                </div>
              </div>
            ))}
          </details>
          <h3>Resultados del partido</h3>
          {results.length === 0 && <p>Todavía no hay valoraciones.</p>}
          {results.map((r) => (
            <div className="account-request" key={r.playerId}>
              <strong>
                <span className="player-identity"><PlayerFace id={r.playerId} />{data.players.find((p) => p.id === r.playerId)?.name}</span>
              </strong>
              <span>
                {Number(r.average).toFixed(2)} · {r.count} valoración
                {r.count === 1 ? "" : "es"} · 👍 {r.approvals} 👎{" "}
                {r.disapprovals}
              </span>
              {r.comments.map((c, i) => (
                <p key={i}>{c}</p>
              ))}
            </div>
          ))}
          <p className="panel-footnote">
            Los resultados aparecen al recibir cada valoración. En grupos
            pequeños, los cambios o el contenido de un comentario pueden
            permitir deducir quién lo escribió.
          </p>
        </>
      )}
    </section>
  );
}
