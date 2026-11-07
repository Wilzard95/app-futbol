import { useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Save,
  Trophy,
  Users,
  Vote,
} from "lucide-react";
import { demoSessionPlayerIds } from "../data/demo";
import {
  anonymousLineups,
  defaultFormationIds,
  formationCatalog,
  formationVoting,
  getFormation,
  lineupConsensus,
  suggestLineup,
  upsertLineup,
} from "../domain/lineups";
import type {
  Formation,
  LineupProposal,
  Player,
  Tournament,
} from "../domain/types";
import LineupPitch from "./LineupPitch";

interface SharedProps {
  tournament: Tournament;
  players: Player[];
  averages: Record<string, number | null>;
  proposals: LineupProposal[];
}
type Voting = ReturnType<typeof formationVoting>;
const rosterIds = (players: Player[]) => players.map((player) => player.id);
const voterIds = (players: Player[]) =>
  players.filter((player) => player.linked).map((player) => player.id);
const namesOfLeaders = (voting: Voting) =>
  voting.entries
    .filter((entry) => voting.leaders.includes(entry.formation.id))
    .map((entry) => entry.formation.name)
    .join(" y ");

function MiniFormation({ formation }: { formation: Formation }) {
  return (
    <svg viewBox="0 0 100 110" aria-hidden="true">
      <rect
        x="5"
        y="5"
        width="90"
        height="100"
        rx="3"
        fill="none"
        stroke="currentColor"
        opacity=".3"
      />
      <path d="M5 55h90" stroke="currentColor" opacity=".2" />
      <circle
        cx="50"
        cy="55"
        r="13"
        fill="none"
        stroke="currentColor"
        opacity=".2"
      />
      {formation.slots.map((slot) => (
        <circle
          key={slot.id}
          cx={slot.x}
          cy={slot.y}
          r="4"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

function FormationVotes({
  voting,
  selectedId,
  onSelect,
  compact = false,
}: {
  voting: Voting;
  selectedId?: string;
  onSelect?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`formation-votes ${compact ? "compact-votes" : ""}`}>
      {voting.entries.map((entry) => {
        const leader = voting.leaders.includes(entry.formation.id);
        const content = (
          <>
            <div className="formation-vote-label">
              <strong>{entry.formation.name}</strong>
              {leader && (
                <span>
                  <Trophy size={11} />
                  {voting.leaders.length > 1 ? "Empatada" : "Más elegida"}
                </span>
              )}
              <small>
                {entry.votes} voto{entry.votes !== 1 ? "s" : ""} ·{" "}
                {Math.round(entry.percentage)}%
              </small>
            </div>
            <span className="formation-vote-track">
              <span style={{ width: `${entry.percentage}%` }} />
            </span>
          </>
        );
        return onSelect ? (
          <button
            type="button"
            key={entry.formation.id}
            className={`formation-vote-row ${selectedId === entry.formation.id ? "inspecting" : ""}`}
            aria-pressed={selectedId === entry.formation.id}
            onClick={() => onSelect(entry.formation.id)}
            aria-label={`Ver formación ${entry.formation.name}, ${entry.votes} voto${entry.votes !== 1 ? "s" : ""}`}
          >
            {content}
          </button>
        ) : (
          <div key={entry.formation.id} className="formation-vote-row">
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function LineupOverview(props: SharedProps) {
  const voting = formationVoting(
    props.tournament.id,
    props.tournament.format,
    props.proposals,
    rosterIds(props.players),
    voterIds(props.players),
  );
  const id = voting.leaders.includes(
    defaultFormationIds[props.tournament.format],
  )
    ? defaultFormationIds[props.tournament.format]
    : (voting.leaders[0] ?? defaultFormationIds[props.tournament.format]);
  const selected = getFormation(props.tournament.format, id);
  const collective = lineupConsensus(
    props.tournament.id,
    selected,
    props.proposals,
    rosterIds(props.players),
    voterIds(props.players),
  );
  return (
    <>
      <div className="overview-formation-leader">
        {voting.total ? (
          <>
            <Trophy size={13} />
            <span>
              {voting.leaders.length > 1 ? "Empate: " : "Más elegida: "}
              <strong>{namesOfLeaders(voting)}</strong>
            </span>
          </>
        ) : (
          "Todavía no hay propuestas."
        )}
      </div>
      <LineupPitch
        formation={selected}
        positions={collective.positions}
        players={props.players}
        averages={props.averages}
        caption={`Titular de ${selected.name}`}
        compact
        footer={`${voting.total} propuestas · ${collective.proposalCount} eligen ${selected.name}`}
      />
    </>
  );
}

export default function LineupLab(
  props: SharedProps & {
    onProposalsChange: (proposals: LineupProposal[]) => void;
  },
) {
  const [view, setView] = useState<"mine" | "results">("mine");
  const sessions = props.players.filter(
    (player) => player.linked && demoSessionPlayerIds.includes(player.id),
  );
  const [authorId, setAuthorId] = useState(sessions[0].id);
  const voting = formationVoting(
    props.tournament.id,
    props.tournament.format,
    props.proposals,
    rosterIds(props.players),
    voterIds(props.players),
  );
  return (
    <div className="lineup-lab">
      <div className="lineup-workflow">
        <div role="group" aria-label="Vista de titulares">
          <button
            type="button"
            aria-pressed={view === "mine"}
            onClick={() => setView("mine")}
          >
            <ClipboardList size={17} />
            Mi titular
          </button>
          <button
            type="button"
            aria-pressed={view === "results"}
            onClick={() => setView("results")}
          >
            <Vote size={17} />
            Votación del equipo
          </button>
        </div>
        <span>
          <Users size={15} />
          {voting.total} propuestas de prueba
        </span>
      </div>
      <div hidden={view !== "mine"}>
        <LineupEditor
          key={`${props.tournament.id}-${authorId}`}
          {...props}
          authorId={authorId}
          sessions={sessions}
          onAuthorChange={setAuthorId}
          voting={voting}
          onViewResults={() => setView("results")}
        />
      </div>
      {view === "results" && <LineupResults {...props} voting={voting} />}
      <div className="lineup-demo-footnote">
        Propuestas de prueba · Una propuesta por persona y torneo. Las sesiones
        se simulan para probar; el anonimato y el guardado entre dispositivos
        requieren el backend. Al recargar se restaura la demo.
      </div>
    </div>
  );
}

function LineupEditor({
  authorId,
  sessions,
  onAuthorChange,
  voting,
  onViewResults,
  ...props
}: SharedProps & {
  authorId: string;
  sessions: Player[];
  onAuthorChange: (id: string) => void;
  voting: Voting;
  onViewResults: () => void;
  onProposalsChange: (proposals: LineupProposal[]) => void;
}) {
  const own = props.proposals.find(
    (item) =>
      item.tournamentId === props.tournament.id &&
      item.authorPlayerId === authorId,
  );
  const [formationId, setFormationId] = useState(
    own?.formationId ?? defaultFormationIds[props.tournament.format],
  );
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(
    () => (own ? { [own.formationId]: { ...own.picks } } : {}),
  );
  const [positionId, setPositionId] = useState("gk");
  const [message, setMessage] = useState("");
  const selected = getFormation(props.tournament.format, formationId);
  const picks = drafts[formationId] ?? {};
  const active = selected.slots.find((slot) => slot.id === positionId)!;
  const filled = selected.slots.filter((slot) => picks[slot.id]).length;
  const complete =
    filled === selected.slots.length &&
    new Set(Object.values(picks).filter(Boolean)).size ===
      selected.slots.length;
  const positions = selected.slots.map((slot) => ({
    ...slot,
    winners: picks[slot.id] ? [picks[slot.id]] : [],
    votes: 0,
  }));

  function chooseFormation(id: string) {
    setFormationId(id);
    setPositionId("gk");
    setMessage("");
  }
  function choosePlayer(id: string) {
    setDrafts((current) => ({
      ...current,
      [formationId]: { ...picks, [positionId]: id },
    }));
    setMessage("");
  }
  function fillExample() {
    setDrafts((current) => ({
      ...current,
      [formationId]: suggestLineup(selected, props.players),
    }));
    setMessage(
      props.players.length < selected.slots.length
        ? `Se ubicaron los ${props.players.length} jugadores de la plantilla. Faltan ${selected.slots.length - props.players.length} para completar esta formación.`
        : "Plantilla completada según las posiciones de los jugadores. Puedes cambiarla antes de guardar.",
    );
  }
  function save() {
    try {
      props.onProposalsChange(
        upsertLineup(
          props.proposals,
          {
            id: own?.id ?? crypto.randomUUID(),
            tournamentId: props.tournament.id,
            authorPlayerId: authorId,
            formationId,
            picks,
          },
          props.tournament.format,
          rosterIds(props.players),
          voterIds(props.players),
        ),
      );
      setMessage(
        `Tu titular ${selected.name} quedó guardada para la prueba. Cuenta como un único voto.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la titular.",
      );
    }
  }

  return (
    <div className="lineup-editor-layout">
      <section className="panel full-pitch lineup-builder">
        <div className="section-heading">
          <div>
            <h2>Elige cómo jugar</h2>
            <p>
              Un arquero y {props.tournament.format - 1} jugadores de campo.
              Toca una posición para asignarla.
            </p>
          </div>
        </div>
        <div className="formation-choices" aria-label="Formaciones disponibles">
          {formationCatalog[props.tournament.format].map((item) => (
            <button
              type="button"
              key={item.id}
              aria-label={`Elegir formación ${item.name}`}
              aria-pressed={formationId === item.id}
              onClick={() => chooseFormation(item.id)}
            >
              <MiniFormation formation={item} />
              <strong>{item.name}</strong>
              {formationId === item.id && <Check size={12} />}
            </button>
          ))}
        </div>
        {props.players.length < selected.slots.length && (
          <p className="lineup-save-status">
            La plantilla tiene {props.players.length} jugadores. Esta modalidad
            necesita {selected.slots.length}; faltan{" "}
            {selected.slots.length - props.players.length} para guardar una
            titular completa.
          </p>
        )}
        <LineupPitch
          formation={selected}
          positions={positions}
          players={props.players}
          averages={props.averages}
          caption="Tu propuesta · vista previa"
          selectedPositionId={positionId}
          onSelectPosition={setPositionId}
          footer="La nota sobre cada camiseta es su promedio del torneo."
        />
        <div className="lineup-save-bar">
          <span>
            <strong>
              {filled}/{props.tournament.format}
            </strong>{" "}
            posiciones completas
          </span>
          <button
            type="button"
            className="lab-primary-button"
            onClick={save}
            disabled={!complete}
          >
            <Save size={15} />
            Guardar mi titular
          </button>
        </div>
        <p role="status" className="lineup-save-status">
          {message ||
            (complete
              ? "Lista para guardar. Tu elección entra en la votación al guardarla."
              : "Completa todas las posiciones sin repetir jugadores.")}
        </p>
      </section>
      <aside className="lineup-editor-sidebar">
        <section className="panel lineup-assignment">
          <div className="section-heading">
            <div>
              <h2>Arma tu equipo</h2>
              <p>Elige un jugador para cada posición.</p>
            </div>
            <ClipboardList size={19} />
          </div>
          <div className="lineup-assignment-fields">
            <label>
              Mi sesión de prueba
              <select
                value={authorId}
                onChange={(event) => onAuthorChange(event.target.value)}
              >
                {sessions.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Posición a completar
              <select
                value={positionId}
                onChange={(event) => setPositionId(event.target.value)}
              >
                {selected.slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.label}
                    {picks[slot.id]
                      ? ` · ${props.players.find((player) => player.id === picks[slot.id])!.name}`
                      : " · vacante"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Jugador para {active.label}
              <select
                value={picks[positionId] ?? ""}
                onChange={(event) => choosePlayer(event.target.value)}
              >
                <option value="">Sin asignar</option>
                {props.players.map((player) => {
                  const occupied = selected.slots.some(
                    (slot) =>
                      slot.id !== positionId && picks[slot.id] === player.id,
                  );
                  return (
                    <option
                      key={player.id}
                      value={player.id}
                      disabled={occupied}
                    >
                      #{player.number} · {player.name}
                      {occupied ? " · ya elegido" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <button
              type="button"
              className="lab-secondary-button"
              onClick={fillExample}
            >
              Completar con plantilla de ejemplo
            </button>
            <p className="lineup-own-vote">
              {own
                ? `Tu voto guardado: ${getFormation(props.tournament.format, own.formationId).name}. Al volver a guardar se reemplaza.`
                : "Todavía no has guardado una titular para este torneo."}
            </p>
          </div>
        </section>
        <section className="panel lineup-leading">
          <div className="section-heading">
            <div>
              <h2>Así va la elección</h2>
              <p>{voting.total} propuestas guardadas en este torneo.</p>
            </div>
            <Trophy size={19} />
          </div>
          <div className="formation-winner">
            <span>
              {voting.leaders.length > 1
                ? "EMPATE EN EL PRIMER LUGAR"
                : voting.total
                  ? "LA MÁS ELEGIDA"
                  : "SIN PROPUESTAS"}
            </span>
            <strong>
              {voting.total
                ? namesOfLeaders(voting)
                : "Tu voto puede ser el primero"}
            </strong>
          </div>
          <FormationVotes voting={voting} compact />
          <button
            type="button"
            className="lineup-button"
            onClick={onViewResults}
          >
            Ver la votación y las titulares <ArrowRight size={15} />
          </button>
        </section>
      </aside>
    </div>
  );
}

function LineupResults({ voting, ...props }: SharedProps & { voting: Voting }) {
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState("consensus");
  const formationId =
    inspectedId ??
    (voting.leaders.includes(defaultFormationIds[props.tournament.format])
      ? defaultFormationIds[props.tournament.format]
      : (voting.leaders[0] ?? defaultFormationIds[props.tournament.format]));
  const selected = getFormation(props.tournament.format, formationId);
  const collective = lineupConsensus(
    props.tournament.id,
    selected,
    props.proposals,
    rosterIds(props.players),
    voterIds(props.players),
  );
  const publicProposals = anonymousLineups(props.tournament.id, props.proposals)
    .map((proposal, index) => ({ ...proposal, number: index + 1 }))
    .filter((proposal) => proposal.formationId === formationId);
  const viewed = publicProposals.find((proposal) => proposal.id === proposalId);
  const positions = viewed
    ? selected.slots.map((slot) => ({
        ...slot,
        winners: [viewed.picks[slot.id]],
        votes: 0,
      }))
    : collective.positions;
  return (
    <div className="lineup-results-layout">
      <section className="panel formation-results">
        <div className="section-heading">
          <div>
            <h2>¿Cómo quiere jugar el equipo?</h2>
            <p>Una propuesta guardada equivale a un voto por su formación.</p>
          </div>
          <Vote size={20} />
        </div>
        <div className="formation-winner">
          <span>
            {voting.leaders.length > 1
              ? "EMPATE EN EL PRIMER LUGAR"
              : "FORMACIÓN MÁS ELEGIDA"}
          </span>
          <strong>
            {voting.total ? namesOfLeaders(voting) : "Aún sin votos"}
          </strong>
        </div>
        <FormationVotes
          voting={voting}
          selectedId={formationId}
          onSelect={(id) => {
            setInspectedId(id);
            setProposalId("consensus");
          }}
        />
        <div className="panel-footnote">
          {voting.total} propuestas en total. Selecciona una formación para ver
          su titular colectiva y las propuestas anónimas correspondientes.
        </div>
      </section>
      <section className="panel full-pitch result-pitch">
        <div className="section-heading">
          <div>
            <h2>Titular de {selected.name}</h2>
            <p>{collective.proposalCount} propuestas eligen esta formación.</p>
          </div>
          <label className="proposal-select">
            <span className="sr-only">Titular a visualizar</span>
            <select
              value={viewed?.id ?? "consensus"}
              onChange={(event) => setProposalId(event.target.value)}
            >
              <option value="consensus">Titular colectiva</option>
              {publicProposals.map((proposal) => (
                <option key={proposal.id} value={proposal.id}>
                  Propuesta anónima {proposal.number}
                </option>
              ))}
            </select>
          </label>
        </div>
        <LineupPitch
          formation={selected}
          positions={positions}
          players={props.players}
          averages={props.averages}
          caption={
            viewed ? "Propuesta anónima" : `Colectiva · ${selected.name}`
          }
          showVotes={!viewed}
          footer={
            viewed
              ? "La identidad del autor no se muestra."
              : collective.proposalCount
                ? "Los empates por posición se muestran superpuestos."
                : "Todavía no hay propuestas para esta formación."
          }
        />
        {!viewed && collective.conflicts.length > 0 && (
          <p className="lineup-result-note">
            Hay jugadores elegidos en varias posiciones. Se muestran esos
            empates sin resolverlos automáticamente.
          </p>
        )}
        <div className="panel-footnote">
          Solo se combinan las propuestas de esta formación. Las notas de los
          jugadores corresponden a {props.tournament.name}.
        </div>
      </section>
    </div>
  );
}
