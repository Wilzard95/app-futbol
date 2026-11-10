import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import {
  defaultFormationIds,
  formationCatalog,
  formationVoting,
  getFormation,
  lineupConsensus,
  suggestLineup,
} from "../domain/lineups";
import type { Format, LineupProposal, Player } from "../domain/types";
import LineupPitch from "./LineupPitch";
import { rawSupabase } from "../supabase";
import type { Visuals } from "../domain/visuals";
type Tournament = { id: string; name: string; format: Format };
type Data = {
  myPlayer: string | null;
  players: Omit<Player, "linked">[];
  tournaments: Tournament[];
  roster: Record<string, string[]>;
};
type Proposal = {
  id: string;
  formationId: string;
  picks: Record<string, string>;
};
type LineupData = {
  mine: Proposal | null;
  proposals: Proposal[];
  averages: Record<string, number>;
};
const client = supabase!;
export default function RealLineups({ onAccount, teamId }: { onAccount: () => void; teamId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [tid, setTid] = useState("");
  const [all, setAll] = useState<LineupData | null>(null);
  const [formationId, setFormationId] = useState("");
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [slot, setSlot] = useState("gk");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewFormation, setViewFormation] = useState("");
  const [visuals, setVisuals] = useState<Visuals | null>(null);
  useEffect(() => {
    let active = true;
    if (teamId && session) void rawSupabase!.rpc("multi_visuals", { team: teamId }).then(({ data, error }) => { if (active && !error) setVisuals(data as Visuals); });
    return () => { active = false; };
  }, [teamId, session?.user.id]);
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
    setAll(null);
    setTid("");
    setFormationId("");
    setPicks({});
    if (!session) return;
    const load = (initial: boolean) =>
      client.rpc("sports_data").then(({ data, error }) => {
        if (!active) return;
        if (error) {
          if (initial || error.message.includes("Sin acceso")) {
            setData(null);
            setMessage("Necesitas una ficha aprobada para ver las titulares.");
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
  const tour = data?.tournaments.find((t) => t.id === tid);
  useEffect(() => {
    if (!tid || !tour) return;
    let active = true;
    setAll(null);
    setMessage("");
    const fetchData = (initialize: boolean) => {
      client.rpc("lineup_data", { tournament: tid }).then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMessage(error.message);
          return;
        }
        const next = data as LineupData;
        setAll(next);
        if (initialize) {
          setFormationId(
            next.mine?.formationId ?? defaultFormationIds[tour.format],
          );
          setPicks(next.mine?.picks ?? {});
          setSlot("gk");
        }
      });
    };
    fetchData(true);
    const timer = window.setInterval(() => fetchData(false), 5000);
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
        <h2>Titular del equipo</h2>
        <p>Entra con tu cuenta vinculada para participar.</p>
        <button className="lab-primary-button" onClick={onAccount}>
          Ir a Mi cuenta
        </button>
      </section>
    );
  if (!data)
    return (
      <section className="panel connected-panel">
        <h2>Titular del equipo</h2>
        <p>{message || "Cargando…"}</p>
        <button className="text-button" onClick={onAccount}>
          Ir a Mi cuenta
        </button>
      </section>
    );
  if (!tour || !all || !formationId)
    return (
      <section className="panel connected-panel">
        {message || "Cargando torneos…"}
      </section>
    );
  const players: Player[] = data.players.filter((p) => (data.roster[tid] ?? []).includes(p.id)).map((p) => ({ ...p, linked: true, avatar: visuals?.players[p.id]?.avatar ?? null, photo: visuals?.players[p.id]?.photo ?? null }));
  const roster = players.map((p) => p.id);
  const form = getFormation(tour.format, formationId);
  const proposals: LineupProposal[] = all.proposals.map((p) => ({
    ...p,
    tournamentId: tid,
    authorPlayerId: p.id,
  }));
  const voting = formationVoting(tid, tour.format, proposals, roster);
  const collectiveForm = getFormation(
    tour.format,
    viewFormation || voting.leaders[0] || formationId,
  );
  const consensus = lineupConsensus(tid, collectiveForm, proposals, roster);
  const positions = form.slots.map((s) => ({
    ...s,
    winners: picks[s.id] ? [picks[s.id]] : [],
    votes: 0,
  }));
  async function save() {
    setBusy(true);
    setMessage("");
    const { error } = await client.rpc("lineup_submit", {
      tournament: tid,
      formation: formationId,
      picks,
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Tu titular quedó guardada.");
      const result = await client.rpc("lineup_data", { tournament: tid });
      if (!result.error) setAll(result.data as LineupData);
    }
    setBusy(false);
  }
  return (
    <section className="panel connected-panel">
      <div className="section-heading">
        <div>
          <h2>
            Titular colectiva <span>CUENTAS REALES</span>
          </h2>
          <p>Una propuesta por jugador y torneo. Los autores no se muestran.</p>
        </div>
      </div>
      <div className="account-form">
        <label>
          Torneo
          <select
            value={tid}
            onChange={(e) => {
              setAll(null);
              setFormationId("");
              setTid(e.target.value);
              setViewFormation("");
            }}
          >
            {data.tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · F{t.format}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3>Votación del equipo</h3>
      <p>
        {voting.total} propuestas.{" "}
        {voting.leaders.length
          ? `Más elegida${voting.leaders.length > 1 ? "s" : ""}: ${voting.leaders.map((id) => getFormation(tour.format, id).name).join(", ")}.`
          : "Aún no hay propuestas."}
      </p>
      <p>
        {voting.entries
          .map((e) => `${e.formation.name}: ${e.votes} (${e.percentage.toFixed(0)}%)`)
          .join(" · ")}
      </p>
      <div className="account-form">
        <label>
          Ver titular colectiva de
          <select
            value={collectiveForm.id}
            onChange={(e) => setViewFormation(e.target.value)}
          >
            {formationCatalog[tour.format].map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <LineupPitch
        formation={collectiveForm}
        positions={consensus.positions}
        players={players}
        averages={all.averages}
        caption="Titular colectiva"
        showVotes
        footer={`${consensus.proposalCount} propuestas en esta formación`}
      />
      {consensus.conflicts.length > 0 && (
        <p>
          Hay jugadores elegidos en varias posiciones:{" "}
          {consensus.conflicts
            .map((id) => players.find((p) => p.id === id)?.name)
            .join(", ")}
          .
        </p>
      )}
      {data.myPlayer && roster.includes(data.myPlayer) ? (
        <>
          <h3>Mi titular</h3>
          <div className="account-form">
            <label>
              Mi formación
              <select
                value={formationId}
                onChange={(e) => {
                  setFormationId(e.target.value);
                  setPicks({});
                  setSlot("gk");
                }}
              >
                {formationCatalog[tour.format].map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {players.length < form.slots.length && <p>Faltan {form.slots.length - players.length} jugadores en la plantilla para completar esta formación.</p>}
          <LineupPitch
            formation={form}
            positions={positions}
            players={players}
            averages={all.averages}
            caption="Tu propuesta"
            selectedPositionId={slot}
            onSelectPosition={setSlot}
          />
          <div className="account-form">
            <label>
              Jugador para {form.slots.find((s) => s.id === slot)?.label}
              <select
                value={picks[slot] ?? ""}
                onChange={(e) => setPicks({ ...picks, [slot]: e.target.value })}
              >
                <option value="">Selecciona un jugador</option>
                {players.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={Object.entries(picks).some(
                      ([s, id]) => s !== slot && id === p.id,
                    )}
                  >
                    {p.name} · #{p.number}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPicks(suggestLineup(form, players))}
            >
              Completar con la plantilla
            </button>
            <button disabled={busy || !form.slots.every((position) => !!picks[position.id]) || new Set(Object.values(picks).filter(Boolean)).size !== form.slots.length} onClick={() => void save()}>
              Guardar mi titular
            </button>
          </div>
        </>
      ) : (
        <p>Necesitas una ficha vinculada e inscrita en este torneo para proponer una titular.</p>
      )}
      <p role="status">{message}</p>
      <h3>Propuestas anónimas</h3>
      {all.proposals.map((p, i) => {
        const f = getFormation(tour.format, p.formationId);
        return (
          <details key={p.id}>
            <summary>
              Propuesta {i + 1} · {f.name}
            </summary>
            <LineupPitch
              formation={f}
              positions={f.slots.map((s) => ({
                ...s,
                winners: p.picks[s.id] ? [p.picks[s.id]] : [],
                votes: 0,
              }))}
              players={players}
              averages={all.averages}
              caption="Propuesta anónima"
            />
          </details>
        );
      })}
      <p className="panel-footnote">
        Las notas son el promedio de los partidos valorados del torneo. La
        autoría se oculta, aunque con pocos votos puede inferirse por los
        cambios.
      </p>
    </section>
  );
}
