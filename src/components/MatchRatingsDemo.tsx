import { useState } from "react";
import type { FormEvent } from "react";
import { ClipboardPen, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  adjustedRating,
  eventRules,
  validateMatchEvents,
} from "../domain/events";
import { matchAverage } from "../domain/rules";
import { demoSessionPlayerIds } from "../data/demo";
import MatchCreateForm from "./MatchCreateForm";
import type {
  Match,
  MatchEvent,
  MatchEventKind,
  Player,
  RatingBallot,
} from "../domain/types";

const number = (value: number, digits = 1) => value.toFixed(digits);
const signed = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;
const eventKinds = Object.keys(eventRules) as MatchEventKind[];

interface Props {
  tournamentId: string;
  matches: Match[];
  players: Player[];
  events: MatchEvent[];
  ballots: RatingBallot[];
  onEventsChange: (events: MatchEvent[]) => void;
  onBallotsChange: (ballots: RatingBallot[]) => void;
  onMatchCreate: (match: Match) => void;
}

export default function MatchRatingsDemo(props: Props) {
  const [matchId, setMatchId] = useState(props.matches[0].id);
  const [mode, setMode] = useState<"admin" | "player">("admin");
  const [creatingMatch, setCreatingMatch] = useState(false);
  const match =
    props.matches.find((item) => item.id === matchId) ?? props.matches[0];
  return (
    <section className="panel event-lab">
      <div className="section-heading">
        <div>
          <h2>
            El partido y sus valoraciones <span>DEMO INTERACTIVA</span>
          </h2>
          <p>
            Primero se registran los hechos del partido. Después cada
            participante los valora de forma independiente.
          </p>
        </div>
        <SlidersHorizontal size={21} />
      </div>
      <div
        className="workflow-switch"
        role="group"
        aria-label="Vista de prueba"
      >
        <button
          type="button"
          aria-pressed={mode === "admin"}
          onClick={() => setMode("admin")}
        >
          <ClipboardPen size={17} />
          1. Administrador
        </button>
        <button
          type="button"
          aria-pressed={mode === "player"}
          onClick={() => setMode("player")}
        >
          <SlidersHorizontal size={17} />
          2. Jugador
        </button>
      </div>
      {mode === "admin" && (
        <div className="admin-match-toolbar">
          <p>
            Registra el partido y sus eventos. Cada evaluador elegirá después
            cuánto suman o restan a su propia nota.
          </p>
          <button
            type="button"
            className="lab-primary-button"
            onClick={() => setCreatingMatch(!creatingMatch)}
          >
            <Plus size={15} />
            Registrar otro partido
          </button>
        </div>
      )}
      {mode === "admin" && creatingMatch && (
        <MatchCreateForm
          tournamentId={props.tournamentId}
          players={props.players}
          onCancel={() => setCreatingMatch(false)}
          onCreate={(created) => {
            props.onMatchCreate(created);
            setMatchId(created.id);
            setCreatingMatch(false);
          }}
        />
      )}
      {mode === "player" && (
        <div
          className="event-rule-strip"
          aria-label="Rangos de ajuste por acción"
        >
          {eventKinds.map((kind) => (
            <div key={kind}>
              <span className={`event-mark ${kind}`} aria-hidden="true" />
              <span>{eventRules[kind].label}</span>
              <strong>
                {signed(eventRules[kind].min)} a {signed(eventRules[kind].max)}
              </strong>
            </div>
          ))}
        </div>
      )}
      <label className="lab-match-picker">
        {mode === "admin"
          ? "Partido para registrar eventos"
          : "Partido a calificar"}
        <select
          value={match.id}
          onChange={(event) => setMatchId(event.target.value)}
        >
          {props.matches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.playedAt ?? "Fecha por confirmar"} · vs. {item.opponent} ·{" "}
              {item.goalsFor}–{item.goalsAgainst}
            </option>
          ))}
        </select>
      </label>
      {mode === "admin" ? (
        <AdminEventEditor key={match.id} {...props} match={match} />
      ) : (
        <PlayerRatingView key={match.id} {...props} match={match} />
      )}
      <div className="panel-footnote">
        Partido y eventos registrados con la información indicada. El selector
        de vista simula los dos roles y permite calificar como cualquiera de los
        ocho jugadores. Los cambios se reflejan en el resumen y la titular
        durante esta sesión y se pierden al recargar. El acceso por cuentas, los
        permisos y el guardado privado requieren el backend.
      </div>
    </section>
  );
}

function AdminEventEditor({ match, ...props }: Props & { match: Match }) {
  const participants = props.players.filter((player) =>
    match.participantIds.includes(player.id),
  );
  const [playerId, setPlayerId] = useState(
    participants.find((player) => player.id === "p3")?.id ?? participants[0].id,
  );
  const [kind, setKind] = useState<MatchEventKind>("yellow_card");
  const [context, setContext] = useState("");
  const [message, setMessage] = useState("");
  const player = participants.find((item) => item.id === playerId)!;
  const registeredEvents = props.events.filter(
    (event) => event.matchId === match.id,
  );

  function registerEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = [
      ...props.events,
      {
        id: crypto.randomUUID(),
        matchId: match.id,
        playerId,
        kind,
        context: context.trim(),
      },
    ];
    try {
      validateMatchEvents(match, next);
      props.onEventsChange(next);
      setContext("");
      setMessage(
        `${eventRules[kind].label}: evento registrado para ${player.name}. Cada participante podrá asignarle su propio ajuste.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el evento.",
      );
    }
  }

  return (
    <div className="admin-events-view">
      <div className="admin-event-column">
        <div className="lab-column-heading">
          <ClipboardPen size={18} />
          <div>
            <h3>Registrar eventos del partido</h3>
            <p>Indica qué ocurrió, a quién y el contexto opcional.</p>
          </div>
        </div>
        <form className="event-register-form" onSubmit={registerEvent}>
          <label>
            Jugador del evento
            <select
              value={playerId}
              onChange={(event) => {
                setPlayerId(event.target.value);
                setContext("");
                setMessage("");
              }}
            >
              {participants.map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.number} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evento
            <select
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as MatchEventKind)
              }
            >
              {eventKinds.map((item) => (
                <option key={item} value={item}>
                  {eventRules[item].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contexto <span>(opcional)</span>
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              maxLength={280}
              rows={2}
              placeholder="Ej.: cortó un contragolpe o protestó al árbitro"
            />
          </label>
          <button className="lab-primary-button" type="submit">
            <Plus size={15} />
            Registrar evento del partido
          </button>
        </form>
        <p className="lab-status" role="status">
          {message}
        </p>
      </div>
      <div className="registered-match-events">
        <h3>
          Eventos registrados <span>{registeredEvents.length}</span>
        </h3>
        <p>
          Estos son los mismos hechos que verán los jugadores al calificar este
          partido.
        </p>
        {registeredEvents.length === 0 ? (
          <p className="lab-empty">Este partido todavía no tiene eventos.</p>
        ) : (
          registeredEvents.map((event, index) => (
            <div className="registered-event" key={event.id}>
              <span className={`event-mark ${event.kind}`} aria-hidden="true" />
              <div>
                <strong>
                  {eventRules[event.kind].label} ·{" "}
                  {
                    props.players.find((item) => item.id === event.playerId)!
                      .name
                  }
                </strong>
                {event.context && <p>{event.context}</p>}
              </div>
              <button
                type="button"
                onClick={() => {
                  props.onEventsChange(
                    props.events.filter((item) => item.id !== event.id),
                  );
                  setMessage(
                    "Evento retirado junto con sus ajustes de prueba.",
                  );
                }}
                aria-label={`Quitar ${eventRules[event.kind].label.toLowerCase()}, evento ${index + 1}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PlayerRatingView({ match, ...props }: Props & { match: Match }) {
  const participants = props.players.filter((player) =>
    match.participantIds.includes(player.id),
  );
  const linked = participants.filter((player) => player.linked);
  const preferred = linked.filter((player) =>
    demoSessionPlayerIds.includes(player.id),
  );
  const sessions = preferred.length ? preferred : linked;
  const [authorId, setAuthorId] = useState(sessions[0]?.id ?? "");
  const [playerId, setPlayerId] = useState(
    participants.find((player) => player.id === "p3")?.id ?? participants[0].id,
  );
  const player = participants.find((item) => item.id === playerId)!;
  if (!sessions.length)
    return (
      <p className="lab-empty player-rating-view">
        Se necesita un participante vinculado para calificar este partido.
      </p>
    );
  return (
    <div className="player-rating-view">
      <div className="demo-session-box">
        <strong>
          Sesión de prueba:{" "}
          {sessions.find((item) => item.id === authorId)!.name}
        </strong>
        <p>
          Estás editando únicamente la valoración de esta cuenta simulada.
          Puedes cambiar de sesión entre los ocho jugadores para probar
          opiniones distintas sobre el mismo evento.
        </p>
        <label>
          Simular mi cuenta
          <select
            value={authorId}
            onChange={(event) => setAuthorId(event.target.value)}
          >
            {sessions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="lab-player-picker">
        Jugador a calificar
        <select
          value={playerId}
          onChange={(event) => setPlayerId(event.target.value)}
        >
          {participants.map((item) => (
            <option key={item.id} value={item.id}>
              #{item.number} · {item.name}
            </option>
          ))}
        </select>
      </label>
      <BallotEditor
        key={`${playerId}-${authorId}`}
        match={match}
        player={player}
        authorId={authorId}
        events={props.events}
        ballots={props.ballots}
        onBallotsChange={props.onBallotsChange}
      />
    </div>
  );
}

function BallotEditor({
  match,
  player,
  authorId,
  events,
  ballots,
  onBallotsChange,
}: {
  match: Match;
  player: Player;
  authorId: string;
  events: MatchEvent[];
  ballots: RatingBallot[];
  onBallotsChange: Props["onBallotsChange"];
}) {
  const previous = ballots.find(
    (ballot) =>
      ballot.matchId === match.id &&
      ballot.authorPlayerId === authorId &&
      ballot.targetPlayerId === player.id,
  );
  const [base, setBase] = useState(previous ? String(previous.score) : "");
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (previous?.eventAdjustments ?? []).map((item) => [
        item.eventId,
        item.value,
      ]),
    ),
  );
  const [saved, setSaved] = useState(false);
  const targetEvents = events.filter(
    (event) => event.matchId === match.id && event.playerId === player.id,
  );
  const draft: RatingBallot = {
    matchId: match.id,
    authorPlayerId: authorId,
    targetPlayerId: player.id,
    score: Number(base),
    eventAdjustments: targetEvents.map((event) => ({
      eventId: event.id,
      value: values[event.id] ?? 0,
    })),
  };
  const valid =
    base.trim() !== "" &&
    Number.isFinite(draft.score) &&
    draft.score >= 1 &&
    draft.score <= 10;
  const result = valid ? adjustedRating(match, draft, events) : null;
  const average = matchAverage(match, player.id, ballots, events);

  function applyRating(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result) return;
    const others = ballots.filter(
      (ballot) =>
        !(
          ballot.matchId === draft.matchId &&
          ballot.authorPlayerId === authorId &&
          ballot.targetPlayerId === player.id
        ),
    );
    onBallotsChange([...others, draft]);
    setSaved(true);
  }

  return (
    <form className="ballot-column" onSubmit={applyRating}>
      <div className="lab-column-heading">
        <SlidersHorizontal size={18} />
        <div>
          <h3>Tu valoración de {player.name}</h3>
          <p>
            Los eventos los registró el administrador. Tú decides su efecto en
            tu nota.
          </p>
        </div>
      </div>
      <label className="base-score-field">
        Tu nota general para {player.name.split(" ")[0]}
        <input
          type="number"
          min={1}
          max={10}
          step={0.1}
          required
          placeholder="1 a 10"
          value={base}
          onChange={(event) => {
            setBase(event.target.value);
            setSaved(false);
          }}
        />
        <span>
          Escríbela tú, del 1 al 10, según su desempeño en el partido.
        </span>
      </label>
      <div className="personal-adjustments-heading">
        <h4>Tus ajustes por los eventos registrados</h4>
        <p>
          Otro compañero puede valorar el mismo evento de forma distinta. Cada
          ajuste se suma únicamente a la nota de quien lo emite.
        </p>
      </div>
      <div className="adjustment-list">
        {targetEvents.map((event, index) => {
          const rule = eventRules[event.kind];
          const inputId = `adjustment-${event.id}`;
          return (
            <div className="adjustment-item" key={event.id}>
              <div className="adjustment-title">
                <label htmlFor={inputId}>
                  <span
                    className={`event-mark ${event.kind}`}
                    aria-hidden="true"
                  />
                  {rule.label} · {index + 1}
                </label>
                <output htmlFor={inputId}>
                  {signed(values[event.id] ?? 0)}
                </output>
              </div>
              {event.context && <p>{event.context}</p>}
              <input
                id={inputId}
                type="range"
                min={rule.min}
                max={rule.max}
                step={0.1}
                value={values[event.id] ?? 0}
                onChange={(change) => {
                  setValues({
                    ...values,
                    [event.id]: Number(change.target.value),
                  });
                  setSaved(false);
                }}
              />
              <div className="range-labels">
                <span>{signed(rule.min)}</span>
                <span>{signed(rule.max)}</span>
              </div>
            </div>
          );
        })}
        {targetEvents.length === 0 && (
          <p className="lab-empty">
            Este jugador no tiene eventos registrados en el partido. Su nota
            general será tu nota final.
          </p>
        )}
      </div>
      <div className="rating-calculation" aria-live="polite">
        <div>
          <span>Tu nota general</span>
          <strong>{valid ? number(draft.score) : "—"}</strong>
        </div>
        <span>+</span>
        <div>
          <span>Tus ajustes</span>
          <strong>{result ? signed(result.adjustment) : "—"}</strong>
        </div>
        <span>=</span>
        <div className="final-rating">
          <span>Tu nota final</span>
          <strong>{result ? number(result.finalScore) : "—"}</strong>
        </div>
      </div>
      {result?.limited && (
        <p className="clamp-note">
          La suma da {number(result.rawScore)}; tu nota final se limita a{" "}
          {number(result.finalScore)} para mantener la escala de 1 a 10.
        </p>
      )}
      <button className="lab-primary-button" type="submit" disabled={!valid}>
        Guardar mi valoración de prueba
      </button>
      <div className="collective-average">
        <span>
          Promedio colectivo del partido
          <strong>{average === null ? "—" : number(average, 2)}</strong>
        </span>
        <p>
          Primero se calcula la nota final de cada evaluador; después se
          promedian todas. Se muestran dos decimales para apreciar ajustes
          pequeños. El promedio solo incluye las valoraciones que ustedes
          guarden en esta prueba.
        </p>
      </div>
      <p className="lab-status" role="status">
        {saved
          ? "Tu valoración de prueba quedó aplicada al promedio del partido y del torneo."
          : "Solo tu valoración cambia al guardar. Las opiniones de los demás se mantienen independientes."}
      </p>
    </form>
  );
}
