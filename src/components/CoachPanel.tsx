import { useEffect, useState } from "react";
import { rawSupabase } from "../supabase";
import ProfileVisualEditor from "./ProfileVisualEditor";

type Coach = { id: string; name: string; occupied: boolean; email: string | null };
type Claim = { userId: string; coachId: string; name: string; email: string };
type CoachData = { owner: boolean; myCoach: string | null; pending: string | null; coaches: Coach[]; claims: Claim[] };

export default function CoachPanel({ teamId, invitation, onChanged }: { teamId: string; invitation: string | null; onChanged: () => Promise<void> }) {
  const [data, setData] = useState<CoachData | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    const result = await rawSupabase!.rpc("multi_coach_data", { team: teamId, invite_code: invitation });
    if (!result.error) setData(result.data as CoachData);
  }
  useEffect(() => {
    let active = true;
    const poll = () => { void rawSupabase!.rpc("multi_coach_data", { team: teamId, invite_code: invitation }).then(({ data: result, error }) => { if (active && !error) setData(result as CoachData); }); };
    poll(); const timer = window.setInterval(poll, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [teamId, invitation]);
  async function act(nameOfAction: string, args: Record<string, unknown>, success: string) {
    setBusy(true); setMessage("");
    try {
      const { error } = await rawSupabase!.rpc(nameOfAction, { team: teamId, ...args });
      if (error) { setMessage(error.message); return; }
      await load(); await onChanged(); setMessage(success);
      if (nameOfAction === "multi_coach_create") setName("");
      if (nameOfAction === "multi_coach_request") setSelected("");
    } catch { setMessage("No se pudo conectar. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  if (!data) return null;
  const available = data.coaches.filter(coach => !coach.occupied);
  return <section className="coach-panel"><h3>Entrenadores</h3>
    <p>Un entrenador tiene permisos de administración y puede tener también una ficha de jugador.</p>
    {data.myCoach && <p>Tu ficha de entrenador: <strong>{data.coaches.find(c => c.id === data.myCoach)?.name}</strong>. Si acabas de recibir la aprobación, recarga la página para actualizar tus permisos.</p>}
    {data.myCoach && <ProfileVisualEditor team={teamId} player={data.myCoach} coach />}
    {data.pending && <p>Tu solicitud de entrenador está pendiente de aprobación por el creador.</p>}
    {!data.myCoach && !data.pending && available.length > 0 && <div className="account-form">
      <label>Vincularme como entrenador<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Selecciona una ficha</option>{available.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button type="button" disabled={busy || !selected} onClick={() => void act("multi_coach_request", { coach: selected, invite_code: invitation }, "Solicitud enviada al creador.")}>Solicitar ficha de entrenador</button>
    </div>}
    {data.owner && <><form className="account-form" onSubmit={e => { e.preventDefault(); void act("multi_coach_create", { coach_name: name }, "Ficha de entrenador creada."); }}><label>Nombre del entrenador<input value={name} onChange={e => setName(e.target.value)} maxLength={100} required /></label><button disabled={busy || !name.trim()}>Crear ficha de entrenador</button></form>
      <h4>Fichas de entrenador</h4>{data.coaches.length === 0 && <p>Aún no hay fichas de entrenador.</p>}
      {data.coaches.map(c => <div className="account-request" key={c.id}><span><strong>{c.name}</strong> · {c.occupied ? `Vinculada${c.email ? ` a ${c.email}` : ""}` : "Disponible"}</span>{c.occupied && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`¿Desvincular a ${c.name} como entrenador? Si obtuvo permisos de administrador solo por esa ficha, los perderá.`)) void act("multi_coach_unlink", { coach: c.id }, "Ficha de entrenador desvinculada."); }}>Desvincular entrenador</button>}</div>)}
      <h4>Solicitudes de entrenador</h4>{data.claims.length === 0 && <p>No hay solicitudes pendientes.</p>}
      {data.claims.map(c => <div className="account-request" key={c.userId}><span>{c.email} solicita la ficha de {c.name}.</span><button type="button" disabled={busy} onClick={() => void act("multi_coach_decide", { claimant: c.userId, approve: true }, "Entrenador aprobado con permisos de administrador.")}>Aprobar como entrenador y admin</button><button type="button" disabled={busy} onClick={() => void act("multi_coach_decide", { claimant: c.userId, approve: false }, "Solicitud rechazada.")}>Rechazar</button></div>)}
    </>}
    <p role="status">{message}</p>
  </section>;
}

