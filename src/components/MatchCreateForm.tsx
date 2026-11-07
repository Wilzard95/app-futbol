import { useState } from "react";
import type { FormEvent } from "react";
import type { Match, Player } from "../domain/types";

export default function MatchCreateForm({
  tournamentId,
  players,
  onCreate,
  onCancel,
}: {
  tournamentId: string;
  players: Player[];
  onCreate: (match: Match) => void;
  onCancel: () => void;
}) {
  const [opponent, setOpponent] = useState("");
  const [playedAt, setPlayedAt] = useState(() => {
    const today = new Date();
    return new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
  });
  const [goalsFor, setGoalsFor] = useState("0");
  const [goalsAgainst, setGoalsAgainst] = useState("0");
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!opponent.trim() || !playedAt || !participants.length) {
      setError(
        "Indica el rival, la fecha y al menos un jugador que haya participado.",
      );
      return;
    }
    const scored = Number(goalsFor);
    const conceded = Number(goalsAgainst);
    if (
      !goalsFor.trim() ||
      !goalsAgainst.trim() ||
      !Number.isSafeInteger(scored) ||
      !Number.isSafeInteger(conceded) ||
      scored < 0 ||
      conceded < 0
    ) {
      setError(
        "El marcador debe contener goles enteros mayores o iguales a cero.",
      );
      return;
    }
    onCreate({
      id: crypto.randomUUID(),
      tournamentId,
      opponent: opponent.trim(),
      playedAt,
      goalsFor: scored,
      goalsAgainst: conceded,
      participantIds: participants,
    });
  }

  return (
    <form className="match-create-form" onSubmit={submit}>
      <h3>Registrar partido</h3>
      <p>
        Indica el resultado y quién jugó. A continuación podrás añadir los
        eventos aquí mismo.
      </p>
      <div className="match-form-fields">
        <label>
          Rival
          <input
            value={opponent}
            maxLength={100}
            required
            onChange={(event) => setOpponent(event.target.value)}
            placeholder="Nombre del equipo rival"
          />
        </label>
        <label>
          Fecha
          <input
            type="date"
            value={playedAt}
            required
            onChange={(event) => setPlayedAt(event.target.value)}
          />
        </label>
        <label>
          Nuestros goles
          <input
            type="number"
            min={0}
            step={1}
            value={goalsFor}
            required
            onChange={(event) => setGoalsFor(event.target.value)}
          />
        </label>
        <label>
          Goles del rival
          <input
            type="number"
            min={0}
            step={1}
            value={goalsAgainst}
            required
            onChange={(event) => setGoalsAgainst(event.target.value)}
          />
        </label>
      </div>
      <fieldset>
        <legend>Jugadores que participaron</legend>
        <div className="participant-checks">
          {players.map((player) => (
            <label key={player.id}>
              <input
                type="checkbox"
                checked={participants.includes(player.id)}
                onChange={(event) =>
                  setParticipants((current) =>
                    event.target.checked
                      ? [...current, player.id]
                      : current.filter((id) => id !== player.id),
                  )
                }
              />
              <span>
                #{player.number} · {player.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="lab-status" role="alert">
          {error}
        </p>
      )}
      <div className="match-form-buttons">
        <button type="submit" className="lab-primary-button">
          Registrar partido y añadir eventos
        </button>
        <button
          type="button"
          className="lab-secondary-button"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
