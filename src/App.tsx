import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
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
  teamName,
  proposals as demoProposals,
  tournaments,
} from "./data/demo";
import MatchRatingsDemo from "./components/MatchRatingsDemo";
import Account from "./components/Account";
import RealRatings from "./components/RealRatings";
import RealLineups from "./components/RealLineups";
import RealOverview from "./components/RealOverview";
import LineupLab, { LineupOverview } from "./components/LineupLab";
import { tournamentAverage } from "./domain/rules";
import type { MatchEvent, Player } from "./domain/types";

type View = "overview" | "players" | "matches" | "lineup" | "account";
const navigation: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard },
  { id: "players", label: "Plantilla", icon: Users },
  { id: "matches", label: "Partidos", icon: CalendarDays },
  { id: "lineup", label: "Titular colectiva", icon: ClipboardList },
  { id: "account", label: "Mi cuenta", icon: LockKeyhole },
];
const scoreLabel = (score: number | null) =>
  score === null ? "—" : score.toFixed(1);
const initials = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("");
const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${value}T12:00:00Z`))
    : "Fecha por confirmar";

function PlayerAvatar({
  player,
  small = false,
}: {
  player: Player;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar ${small ? "small" : ""} tone-${Number(player.number) % 4}`}
      aria-hidden="true"
    >
      {initials(player.name)}
    </span>
  );
}

export default function App() {
  const [view, setView] = useState<View>(() =>
    new URLSearchParams(location.search).has("account") ||
    !!localStorage.getItem("la-cancha-invite")
      ? "account"
      : "overview",
  );
  const tournamentId = tournaments[0].id;
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
              {full && <th scope="col">Sesión de prueba</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={full ? 4 : 3} className="empty-ratings">
                  Aún no hay calificaciones. En Partidos puedes guardar tu
                  valoración de prueba.
                </td>
              </tr>
            )}
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
                      {player.linked
                        ? "Disponible para simular"
                        : "No disponible"}
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
            <strong>{teamName}</strong>
            <span>Equipo en prueba</span>
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
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <LockKeyhole size={20} />
          <strong>Tu voz también juega.</strong>
          <p>Las valoraciones y titulares reales no muestran quién las propone.</p>
          <span>Los resultados se publican al recibir cada voto</span>
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
            {teamName} <span>/</span> <strong>{activeNav.label}</strong>
          </div>
          <span className="demo-pill">
            <span /> EN PRUEBA
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
                      : view === "lineup"
                        ? "La titular la elegimos todos."
                        : "Tu cuenta en el equipo."}
              </h1>
              <p>
                {view === "overview"
                  ? "Lo que jugamos, lo que aprendemos y el equipo que construimos."
                  : view === "players"
                    ? "Una ficha por jugador. Sus números cambian con cada torneo."
                    : view === "matches"
                      ? "Solo quienes participaron podrán valorar y recibir valoraciones."
                      : view === "lineup"
                        ? "Propuestas anónimas. Una elección colectiva para cada posición."
                        : "Entra y vincula tu ficha de jugador."}
              </p>
            </div>
          </div>

          {view === "overview" && (
            <>
              <RealOverview
                mode="overview"
                onAccount={() => setView("account")}
              />
              {import.meta.env.DEV && (
              <details>
                <summary>Ver resumen de la simulación</summary>
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
                        diseño protege la autoría incluso frente al
                        administrador del equipo.
                      </p>
                    </div>
                  </div>
                </div>
              </details>
              )}
            </>
          )}

          {view === "players" && (
            <>
              <RealOverview
                mode="players"
                onAccount={() => setView("account")}
              />
              {import.meta.env.DEV && (
              <details>
                <summary>Ver plantilla de la simulación</summary>
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>
                        Plantilla del equipo{" "}
                        <span>{players.length} JUGADORES</span>
                      </h2>
                      <p>
                        Notas de {tournament.name}. Sin valoraciones se muestra
                        «—».
                      </p>
                    </div>
                    <Users size={21} />
                  </div>
                  {ratingsTable(true)}
                  <div className="panel-footnote">
                    Esta tabla solo indica quiénes pueden usarse en la
                    simulación; no muestra qué cuentas reales están vinculadas.
                    El administrador puede revisar las fichas vinculadas en «Mi
                    cuenta».
                  </div>
                </section>
              </details>
              )}
            </>
          )}
          {view === "matches" && (
            <>
              <RealRatings onAccount={() => setView("account")} />
              {import.meta.env.DEV && (
              <details>
                <summary>Simulación de partidos (datos de prueba)</summary>
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
              </details>
              )}
            </>
          )}
          {view === "lineup" && (
            <>
              <RealLineups onAccount={() => setView("account")} />
              {import.meta.env.DEV && (
              <details>
                <summary>Simulación de titulares (datos de prueba)</summary>
                <LineupLab
                  key={tournamentId}
                  tournament={tournament}
                  players={players}
                  averages={playerAverages}
                  proposals={lineups}
                  onProposalsChange={setLineups}
                />
              </details>
              )}
            </>
          )}
          {view === "account" && <Account />}

          <footer className="page-footer">
            <span>
              LA CANCHA <span>·</span> Hecho para jugar en equipo.
            </span>
            <span>Equipo conectado · Proyecto en prueba</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
