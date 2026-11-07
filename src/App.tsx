import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CodeXml,
  Flag,
  LayoutDashboard,
  LockKeyhole,
  Shield,
  Target,
  Trophy,
  Users,
  Vote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ballots,
  matchEvents,
  matches as demoMatches,
  players,
  proposals as demoProposals,
  tournaments,
} from "./data/demo";
import MatchRatingsDemo from "./components/MatchRatingsDemo";
import LineupLab, { LineupOverview } from "./components/LineupLab";
import { tournamentAverage } from "./domain/rules";
import type { MatchEvent, Player } from "./domain/types";

type View = "overview" | "players" | "matches" | "lineup";
const navigation: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard },
  { id: "players", label: "Plantilla", icon: Users },
  { id: "matches", label: "Partidos", icon: CalendarDays },
  { id: "lineup", label: "Titular colectiva", icon: ClipboardList },
];
const scoreLabel = (score: number | null) =>
  score === null ? "—" : score.toFixed(1);
const initials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("");
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));

function PlayerAvatar({
  player,
  small = false,
}: {
  player: Player;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar ${small ? "small" : ""} tone-${player.number % 4}`}
      aria-hidden="true"
    >
      {initials(player.name)}
    </span>
  );
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [tournamentId, setTournamentId] = useState(tournaments[0].id);
  const [lineups, setLineups] = useState(demoProposals);
  const [events, setEvents] = useState(matchEvents);
  const [ratings, setRatings] = useState(ballots);
  const [matches, setMatches] = useState(demoMatches);
  const tournament = tournaments.find((item) => item.id === tournamentId)!;
  const tournamentMatches = matches.filter(
    (match) => match.tournamentId === tournamentId,
  );
  const ranking = players
    .map((player) => ({
      player,
      score: tournamentAverage(
        tournamentId,
        player.id,
        matches,
        ratings,
        events,
      ),
    }))
    .sort(
      (a, b) =>
        (b.score ?? -1) - (a.score ?? -1) ||
        a.player.name.localeCompare(b.player.name),
    );
  const ratedPlayers = ranking.filter((item) => item.score !== null);
  const playerAverages = Object.fromEntries(
    ranking.map(({ player, score }) => [player.id, score]),
  );
  const wins = tournamentMatches.filter(
    (match) => match.goalsFor > match.goalsAgainst,
  ).length;
  const draws = tournamentMatches.filter(
    (match) => match.goalsFor === match.goalsAgainst,
  ).length;
  const goals = tournamentMatches.reduce(
    (sum, match) => sum + match.goalsFor,
    0,
  );
  const activeNav = navigation.find((item) => item.id === view)!;

  function selectTournament(id: string) {
    setTournamentId(id);
  }

  function updateEvents(next: MatchEvent[]) {
    const ids = new Set(next.map((event) => event.id));
    setEvents(next);
    setRatings((current) =>
      current.map((ballot) => ({
        ...ballot,
        eventAdjustments: ballot.eventAdjustments?.filter((item) =>
          ids.has(item.eventId),
        ),
      })),
    );
  }

  function ratingsTable(full = false) {
    const rows = full ? ranking : ratedPlayers.slice(0, 5);
    return (
      <div className="table-scroll">
        <table className="player-table">
          <thead>
            <tr>
              <th scope="col">Jugador</th>
              <th scope="col">Partidos</th>
              <th scope="col">Promedio</th>
              {full && <th scope="col">Cuenta</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, score }, index) => (
              <tr key={player.id}>
                <td>
                  <div className="player-cell">
                    <span className="ranking-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <PlayerAvatar player={player} />
                    <div>
                      <strong>{player.name}</strong>
                      <span>
                        {player.position} · #{player.number}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="match-count">
                  {
                    tournamentMatches.filter((match) =>
                      match.participantIds.includes(player.id),
                    ).length
                  }
                </td>
                <td>
                  <span className={`score ${score !== null ? "rated" : ""}`}>
                    {scoreLabel(score)}
                  </span>
                </td>
                {full && (
                  <td>
                    <span
                      className={`account-status ${player.linked ? "linked" : ""}`}
                    >
                      {player.linked ? "Vinculada" : "Por vincular"}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function matchList() {
    return (
      <div className="match-list">
        {tournamentMatches.map((match) => {
          const outcome =
            match.goalsFor > match.goalsAgainst
              ? "V"
              : match.goalsFor === match.goalsAgainst
                ? "E"
                : "D";
          return (
            <article className="match-row" key={match.id}>
              <div className={`result-icon result-${outcome}`}>
                {outcome === "V" ? (
                  <ArrowUpRight size={20} />
                ) : outcome === "D" ? (
                  <ArrowDownLeft size={20} />
                ) : (
                  <span>＝</span>
                )}
              </div>
              <div className="match-opponent">
                <strong>vs. {match.opponent}</strong>
                <span>
                  {dateLabel(match.playedAt)} · {match.participantIds.length}{" "}
                  participantes
                </span>
              </div>
              <strong className="match-score">
                {match.goalsFor} <span>–</span> {match.goalsAgainst}
              </strong>
              <span className={`result-badge result-${outcome}`}>
                {outcome === "V"
                  ? "Victoria"
                  : outcome === "E"
                    ? "Empate"
                    : "Derrota"}
              </span>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setView("overview");
          }}
          aria-label="La Cancha, ir al resumen"
        >
          <span className="brand-symbol">
            <Flag size={24} strokeWidth={2.5} />
          </span>
          <span>
            LA CANCHA<small>EL FÚTBOL ES DE TODOS</small>
          </span>
        </a>
        <div className="team-card">
          <span className="team-crest">
            <Shield size={24} />
          </span>
          <div>
            <strong>Los del Barrio</strong>
            <span>Equipo de muestra</span>
          </div>
        </div>
        <span className="nav-heading">VESTUARIO</span>
        <nav aria-label="Principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={19} />
              {label}
              {id === "lineup" && (
                <span className="nav-new">{tournament.format}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <LockKeyhole size={20} />
          <strong>Tu voz también juega.</strong>
          <p>Valoraciones y titulares sin revelar quién las propone.</p>
          <span>Diseño previsto para la versión real</span>
        </div>
        <a
          className="source-link"
          href="https://github.com/Wilzard95/app-futbol"
          target="_blank"
          rel="noreferrer"
        >
          <CodeXml size={17} /> Ver el proyecto <ArrowUpRight size={14} />
        </a>
        <div className="sidebar-bottom">
          <span className="version-dot" /> Base del proyecto <span>v0.4</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Los del Barrio <span>/</span> <strong>{activeNav.label}</strong>
          </div>
          <span className="demo-pill">
            <span /> DEMOSTRACIÓN
          </span>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">EL EQUIPO, EN UN SOLO LUGAR</div>
              <h1>
                {view === "overview"
                  ? "Dentro y fuera de la cancha."
                  : view === "players"
                    ? "Cada jugador cuenta."
                    : view === "matches"
                      ? "Nuestra historia, partido a partido."
                      : "La titular la elegimos todos."}
              </h1>
              <p>
                {view === "overview"
                  ? "Lo que jugamos, lo que aprendemos y el equipo que construimos."
                  : view === "players"
                    ? "Una ficha por jugador. Sus números cambian con cada torneo."
                    : view === "matches"
                      ? "Solo quienes participaron podrán valorar y recibir valoraciones."
                      : "Propuestas anónimas. Una elección colectiva para cada posición."}
              </p>
            </div>
            <label className="tournament-picker">
              <span>TORNEO ACTIVO</span>
              <div>
                <Trophy size={17} />
                <select
                  value={tournamentId}
                  onChange={(event) => selectTournament(event.target.value)}
                  aria-label="Torneo activo"
                >
                  {tournaments.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · F{item.format}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
          </div>

          {view === "overview" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-tag">
                    <Trophy size={14} /> {tournament.season}{" "}
                    <span>FÚTBOL {tournament.format}</span>
                  </span>
                  <h2>
                    Un equipo.
                    <br />
                    Todas las voces.
                  </h2>
                  <p>
                    El próximo gran partido empieza
                    <br className="desktop-break" /> con lo que construimos
                    juntos.
                  </p>
                  <button onClick={() => setView("lineup")}>
                    Explorar la titular <ArrowRight size={17} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="art-field">
                    <div />
                    <span />
                    <i />
                  </div>
                  <span className="art-number">
                    {String(tournament.format).padStart(2, "0")}
                  </span>
                  <span className="art-caption">AMIGOS. EQUIPO. FÚTBOL.</span>
                </div>
              </section>
              <section className="stats" aria-label="Estadísticas del torneo">
                <div>
                  <span className="stat-icon">
                    <CalendarDays size={20} />
                  </span>
                  <div>
                    <span>Partidos jugados</span>
                    <strong>
                      {String(tournamentMatches.length).padStart(2, "0")}
                    </strong>
                  </div>
                </div>
                <div>
                  <span className="stat-icon">
                    <Trophy size={20} />
                  </span>
                  <div>
                    <span>Victorias</span>
                    <strong>
                      {String(wins).padStart(2, "0")}
                      <small>
                        {draws} empate{draws !== 1 ? "s" : ""}
                      </small>
                    </strong>
                  </div>
                </div>
                <div>
                  <span className="stat-icon">
                    <Target size={20} />
                  </span>
                  <div>
                    <span>Goles a favor</span>
                    <strong>{String(goals).padStart(2, "0")}</strong>
                  </div>
                </div>
                <div>
                  <span className="stat-icon">
                    <Users size={20} />
                  </span>
                  <div>
                    <span>Jugadores con nota</span>
                    <strong>
                      {String(ratedPlayers.length).padStart(2, "0")}
                    </strong>
                  </div>
                </div>
              </section>
              <div className="overview-grid">
                <div className="left-column">
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>
                          Los destacados <span>DEL TORNEO</span>
                        </h2>
                        <p>Promedio de sus partidos valorados.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setView("players")}
                      >
                        Ver plantilla <ArrowRight size={15} />
                      </button>
                    </div>
                    {ratingsTable()}
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Últimos resultados</h2>
                        <p>Así viene el equipo.</p>
                      </div>
                      <span className="muted">
                        <CalendarDays size={18} />
                      </span>
                    </div>
                    {matchList()}
                  </section>
                </div>
                <div className="right-column">
                  <section className="panel lineup-panel">
                    <div className="section-heading">
                      <div>
                        <h2>Titular colectiva</h2>
                        <p>La formación y los jugadores más elegidos.</p>
                      </div>
                      <Vote size={20} />
                    </div>
                    <LineupOverview
                      tournament={tournament}
                      players={players}
                      averages={playerAverages}
                      proposals={lineups}
                    />
                    <button
                      className="lineup-button"
                      onClick={() => setView("lineup")}
                    >
                      Ver todas las propuestas <ArrowRight size={16} />
                    </button>
                  </section>
                  <div className="privacy-note">
                    <LockKeyhole size={17} />
                    <p>
                      <strong>La confianza también se entrena.</strong> El
                      diseño protege la autoría incluso frente al administrador
                      del equipo.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {view === "players" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>
                    Plantilla del equipo <span>{players.length} JUGADORES</span>
                  </h2>
                  <p>
                    Notas de {tournament.name}. Sin valoraciones se muestra «—».
                  </p>
                </div>
                <Users size={21} />
              </div>
              {ratingsTable(true)}
              <div className="panel-footnote">
                Las cuentas y las vinculaciones mostradas son ficticias. El alta
                de jugadores llegará con el backend.
              </div>
            </section>
          )}
          {view === "matches" && (
            <>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>{tournament.name}</h2>
                    <p>
                      Fútbol {tournament.format} · {tournament.season}
                    </p>
                  </div>
                  <CalendarDays size={21} />
                </div>
                {matchList()}
              </section>
              <div className="info-banner">
                <CircleHelp size={20} />
                <div>
                  <strong>
                    Primero, la participación. Después, la valoración.
                  </strong>
                  <p>
                    El administrador registra el partido, quién jugó y sus
                    eventos. Después cada participante elige su nota general y
                    sus ajustes. El promedio se calcula a partir de las notas
                    finales de todos.
                  </p>
                </div>
              </div>
              <MatchRatingsDemo
                key={tournamentId}
                tournamentId={tournamentId}
                matches={tournamentMatches}
                players={players}
                events={events}
                ballots={ratings}
                onEventsChange={updateEvents}
                onBallotsChange={setRatings}
                onMatchCreate={(match) =>
                  setMatches((current) => [match, ...current])
                }
              />
            </>
          )}
          {view === "lineup" && (
            <LineupLab
              key={tournamentId}
              tournament={tournament}
              players={players}
              averages={playerAverages}
              proposals={lineups}
              onProposalsChange={setLineups}
            />
          )}

          <footer className="page-footer">
            <span>
              LA CANCHA <span>·</span> Hecho para jugar en equipo.
            </span>
            <span>
              Datos ficticios · Sin cuentas ni votos reales en esta versión
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
