import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import TournamentRosterAdmin from "./TournamentRosterAdmin";
import { tournamentPlayerStats } from "../domain/player-stats";
import type { MatchEventKind } from "../domain/types";
type Player = { id: string; name: string; number: string; position: string };
type Tournament = { id: string; name: string; format: number };
type Game = {
  id: string;
  tournamentId: string;
  opponent: string;
  playedAt: string | null;
  goalsFor: number;
  goalsAgainst: number;
  participants: string[];
  events: { playerId: string; kind: MatchEventKind }[];
};
type Data = { role: string; players: Player[]; tournaments: Tournament[]; matches: Game[]; roster: Record<string, string[]> };
const client = supabase!;
export default function RealOverview({
  onAccount,
  mode,
}: {
  onAccount: () => void;
  mode: "overview" | "players";
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [tid, setTid] = useState("");
  const [averages, setAverages] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
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
            setMessage("Necesitas una ficha aprobada para ver el equipo.");
          }
          return;
        }
        const next = data as Data;
        setData(next);
        setTid((current) =>
          next.tournaments.some((tournament) => tournament.id === current)
            ? current
            : (next.tournaments[0]?.id ?? ""),
        );
      });
    void load(true);
    const timer = window.setInterval(() => void load(false), 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session?.user.id]);
  useEffect(() => {
    if (!tid || !session) return;
    let active = true;
    const load = () => {
      client.rpc("lineup_data", { tournament: tid }).then(({ data, error }) => {
        if (active && !error)
          setAverages((data as { averages: Record<string, number> }).averages);
      });
    };
    setAverages({});
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tid, session?.user.id]);
  if (!loaded)
    return <section className="panel connected-panel">Cargando…</section>;
  if (!session)
    return (
      <section className="panel connected-panel">
        <h2>Tu equipo</h2>
        <p>Inicia sesión para consultar los datos reales del equipo.</p>
        <button className="lab-primary-button" onClick={onAccount}>
          Ir a Mi cuenta
        </button>
      </section>
    );
  if (!data)
    return (
      <section className="panel connected-panel">
        <h2>Tu equipo</h2>
        <p>{message || "Cargando datos…"}</p>
        <button className="text-button" onClick={onAccount}>
          Ir a Mi cuenta
        </button>
      </section>
    );
  const games = data.matches.filter((g) => g.tournamentId === tid);
  const players = data.players.filter((p) => (data.roster[tid] ?? []).includes(p.id)).sort(
    (a, b) =>
      (averages[b.id] ?? -1) - (averages[a.id] ?? -1) ||
      a.name.localeCompare(b.name),
  );
  return (
    <section className="panel connected-panel">
      <div className="section-heading">
        <div>
          <h2>
            {mode === "players" ? "Plantilla del equipo" : "Resumen del equipo"}{" "}
            <span>DATOS REALES</span>
          </h2>
          <p>
            Promedios calculados con las valoraciones recibidas en cada partido.
          </p>
        </div>
      </div>
      <div className="account-form">
        <label>
          Torneo
          <select value={tid} onChange={(e) => setTid(e.target.value)}>
            {data.tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · F{t.format}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mode === "players" && data.role === "admin" && tid && (
        <TournamentRosterAdmin tournament={tid} players={data.players} enrolled={data.roster[tid] ?? []} onRefresh={async () => {
          const result = await client.rpc("sports_data");
          if (result.error) throw result.error;
          setData(result.data as Data);
        }} />
      )}
      {mode === "overview" && (
        <>
          <h3>Resultados</h3>
          {games.length === 0 && <p>Aún no hay partidos.</p>}
          {games.map((g) => (
            <div className="account-request" key={g.id}>
              <strong>vs. {g.opponent}</strong>
              <span>
                {g.goalsFor}–{g.goalsAgainst} ·{" "}
                {g.playedAt ?? "Fecha pendiente"} · {g.participants.length}{" "}
                participantes
              </span>
            </div>
          ))}
        </>
      )}
      <h3>{mode === "players" ? "Jugadores" : "Promedios del torneo"}</h3>
      {players.length === 0 && <p>Aún no hay jugadores inscritos en este torneo.</p>}
      <div className="table-scroll">
        <table className="player-table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Partidos</th>
              {mode === "overview" && <><th>Goles</th><th>Goles / partido</th><th>Asistencias</th><th>Tarjetas (🟨 / 🟥)</th></>}
              <th>Promedio</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const stats = tournamentPlayerStats(p.id, games);
              return (
              <tr key={p.id}>
                <td>
                  {p.name} · #{p.number} · {p.position}
                </td>
                <td>
                  {stats.matches}
                </td>
                {mode === "overview" && <><td>{stats.goals}</td><td>{stats.goalsPerMatch === null ? "—" : stats.goalsPerMatch.toFixed(2)}</td><td>{stats.assists}</td><td>{stats.yellowCards + stats.redCards} ({stats.yellowCards} / {stats.redCards})</td></>}
                <td>
                  {averages[p.id] == null
                    ? "—"
                    : Number(averages[p.id]).toFixed(1)}
                </td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      <p className="panel-footnote">
        Cada partido valorado aporta el mismo peso al promedio del torneo.
        {mode === "overview" && " Los goles por partido se calculan dividiendo los goles entre los partidos jugados en este torneo."}
      </p>
    </section>
  );
}
