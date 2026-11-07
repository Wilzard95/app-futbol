import { useState } from "react";
import type { FormEvent } from "react";
import { ClipboardPen, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  adjustedRating,
  eventRules,
  validateMatchEvents,
} from "../domain/events";
import { matchAverage } from "../domain/rules";
import type {
  Match,
  MatchEvent,
  MatchEventKind,
  Player,
  RatingBallot,
} from "../domain/types";

const number = (value: number) => value.toFixed(1);
const signed = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;
const eventKinds = Object.keys(eventRules) as MatchEventKind[];

interface Props {
  matches: Match[];
  players: Player[];
  events: MatchEvent[];
  ballots: RatingBallot[];
  onEventsChange: (events: MatchEvent[]) => void;
  onBallotsChange: (ballots: RatingBallot[]) => void;
}

export default function MatchRatingsDemo(props: Props) {
  const [matchId, setMatchId] = useState(props.matches[0].id);
  const match =
    props.matches.find((item) => item.id === matchId) ?? props.matches[0];
  return (
    <section className="panel event-lab">
      <div className="section-heading">
        <div>
          <h2>
            Acciones que cuentan <span>DEMO INTERACTIVA</span>
          </h2>
          <p>
            El administrador registra lo ocurrido. Cada participante decide
            cuánto suma o resta.
          </p>
        </div>
        <SlidersHorizontal size={21} />
      </div>
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
      <label className="lab-match-picker">
        Partido a explorar
        <select
          value={match.id}
          onChange={(event) => setMatchId(event.target.value)}
        >
          {props.matches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.playedAt} · vs. {item.opponent} · {item.goalsFor}–
              {item.goalsAgainst}
            </option>
          ))}
        </select>
      </label>
      <MatchEditor key={match.id} {...props} match={match} />
      <div className="panel-footnote">
        Demostración con datos ficticios. Los cambios se reflejan en el resumen
        y la titular durante esta sesión; se pierden al recargar. Los permisos y
        el guardado privado requieren el backend.
      </div>
    </section>
  );
}

function MatchEditor({ match, ...props }: Props & { match: Match }) {
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
  const targetEvents = props.events.filter(
    (event) => event.matchId === match.id && event.playerId === playerId,
  );
  // This actor is synthetic. Production must derive the author from the session.
  const authorId = participants.find((item) => item.linked)?.id;

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
        `${eventRules[kind].label}: acción registrada para ${player.name}. Ya se puede valorar.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo registrar la acción.",
      );
    }
  }

  function removeEvent(id: string) {
    props.onEventsChange(props.events.filter((event) => event.id !== id));
    setMessage("Acción retirada junto con sus ajustes de prueba.");
  }

  return (
    <>
      <label className="lab-player-picker">
        Jugador participante
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
      <div className="event-lab-grid">
        <div className="admin-event-column">
          <div className="lab-column-heading">
            <ClipboardPen size={18} />
            <div>
              <h3>1. Registrar acciones</h3>
              <p>Vista de administrador de ejemplo</p>
            </div>
          </div>
          <form className="event-register-form" onSubmit={registerEvent}>
            <label>
              Acción
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
              <Plus size={15} /> Registrar acción de prueba
            </button>
          </form>
          <div className="registered-actions">
            <h4>
              Acciones de {player.name.split(" ")[0]}{" "}
              <span>{targetEvents.length}</span>
            </h4>
            {targetEvents.length === 0 ? (
              <p className="lab-empty">
                Sin acciones registradas. Se puede valorar su desempeño con la
                nota base.
              </p>
            ) : (
              targetEvents.map((event, index) => (
                <div className="registered-event" key={event.id}>
                  <span
                    className={`event-mark ${event.kind}`}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>
                      {eventRules[event.kind].label} · acción {index + 1}
                    </strong>
                    {event.context && <p>{event.context}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEvent(event.id)}
                    aria-label={`Quitar ${eventRules[event.kind].label.toLowerCase()}, acción ${index + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
          <p className="lab-status" role="status">
            {message}
          </p>
        </div>
        {authorId ? (
          <BallotEditor
            key={playerId}
            match={match}
            player={player}
            authorId={authorId}
            events={props.events}
            ballots={props.ballots}
            onBallotsChange={props.onBallotsChange}
          />
        ) : (
          <p className="lab-empty">
            Se necesita un participante vinculado para valorar.
          </p>
        )}
      </div>
    </>
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
  const [base, setBase] = useState(String(previous?.score ?? 7));
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
          <h3>2. Valorar el desempeño</h3>
          <p>Tu valoración de ejemplo · autoría privada en la app real</p>
        </div>
      </div>
      <label className="base-score-field">
        Nota base de {player.name.split(" ")[0]}
        <input
          type="number"
          min={1}
          max={10}
          step={0.1}
          required
          value={base}
          onChange={(event) => {
            setBase(event.target.value);
            setSaved(false);
          }}
        />
        <span>Del 1 al 10, antes de los ajustes.</span>
      </label>
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
            Los ajustes aparecerán cuando el administrador registre una acción
            de este jugador.
          </p>
        )}
      </div>
      <div className="rating-calculation" aria-live="polite">
        <div>
          <span>Base</span>
          <strong>{valid ? number(draft.score) : "—"}</strong>
        </div>
        <span>+</span>
        <div>
          <span>Ajustes</span>
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
          La suma da {number(result.rawScore)}; la nota final se limita a{" "}
          {number(result.finalScore)} para mantener la escala de 1 a 10.
        </p>
      )}
      <button className="lab-primary-button" type="submit" disabled={!valid}>
        Aplicar valoración de prueba
      </button>
      <div className="collective-average">
        <span>
          Promedio colectivo del partido
          <strong>{average === null ? "—" : number(average)}</strong>
        </span>
        <p>
          Incluye las notas finales ya aplicadas, cada una con sus propios
          ajustes. Este es el resultado que alimenta el promedio del torneo.
        </p>
      </div>
      <p className="lab-status" role="status">
        {saved
          ? "Valoración de prueba aplicada. Puedes ver el cambio en la plantilla y la titular."
          : "Los cambios del formulario solo afectan el promedio al aplicarlos."}
      </p>
    </form>
  );
}
