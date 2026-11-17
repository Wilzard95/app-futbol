import { useEffect, useState } from "react";
import { rawSupabase } from "../supabase";
import { eventRules } from "../domain/events";
import type { MatchEventKind } from "../domain/types";
import { PlayerFace } from "./PlayerIdentity";
type Player = { id: string; name: string; number: string };
type Action = { id: string; playerId: string; kind: MatchEventKind; context: string };
type Match = { id: string; tournamentId: string; opponent: string; playedAt: string | null; goalsFor: number; goalsAgainst: number; participants: string[]; events: Action[] };
export default function MatchManager({ teamId, games, players, roster, onRefresh }: { teamId: string; games: Match[]; players: Player[]; roster: Record<string,string[]>; onRefresh: () => Promise<void> }) {
 const [id,setId]=useState(""); const game=games.find(g=>g.id===id);
 const [opponent,setOpponent]=useState(""); const [date,setDate]=useState(""); const [gf,setGf]=useState("0"); const [ga,setGa]=useState("0"); const [participants,setParticipants]=useState<string[]>([]);
 const [eventId,setEventId]=useState(""); const [player,setPlayer]=useState(""); const [kind,setKind]=useState<MatchEventKind>("goal"); const [context,setContext]=useState("");
 const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false); const [confirmation,setConfirmation]=useState("");
 useEffect(()=>{ if (!game) return; setOpponent(game.opponent);setDate(game.playedAt ?? "");setGf(String(game.goalsFor));setGa(String(game.goalsAgainst));setParticipants(game.participants);setEventId("");setConfirmation("");setMessage(""); },[id]);
 async function act(rpc:string,args:Record<string,unknown>,success:string) { setBusy(true);setMessage("");try { const {error}=await rawSupabase!.rpc(rpc,{team:teamId,match_id:id,...args});if(error){setMessage(error.message);return false;} await onRefresh();setMessage(success);return true; } catch {setMessage("No se pudo conectar. Inténtalo de nuevo.");return false;}finally{setBusy(false);} }
 async function saveMatch(e:React.FormEvent) { e.preventDefault(); await act("multi_edit_match",{opponent,played_on:date,goals_for:Number(gf),goals_against:Number(ga),participants},"Partido actualizado."); }
 async function saveEvent(remove:boolean) { if(!eventId)return; if(!window.confirm(remove?"¿Eliminar esta acción? Su ajuste se quitará de las valoraciones existentes.":"¿Guardar la corrección? El ajuste anterior de esta acción se quitará de las valoraciones existentes."))return; if(await act("multi_edit_match_event",{event_id:eventId,player_id:player,kind,event_context:context,remove_event:remove},remove?"Acción eliminada.":"Acción actualizada."))setEventId(""); }
 async function deleteMatch() { if(!game||confirmation!==game.opponent||!window.confirm(`¿Eliminar definitivamente el partido contra ${game.opponent}, sus acciones, valoraciones y comentarios?`))return; if(await act("multi_delete_match",{confirmation},"Partido eliminado."))setId(""); }
 return <details className="panel connected-panel"><summary>Editar o eliminar partido</summary>
  <div className="account-form"><label>Partido<select value={id} onChange={e=>setId(e.target.value)}><option value="">Selecciona un partido</option>{games.map(g=><option key={g.id} value={g.id}>{g.playedAt} · vs. {g.opponent} · {g.goalsFor}–{g.goalsAgainst}</option>)}</select></label></div>
  {game && <><h3>Datos y participantes</h3><form className="account-form" onSubmit={saveMatch}>
   <label>Rival<input required maxLength={100} value={opponent} onChange={e=>setOpponent(e.target.value)}/></label><label>Fecha<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label>Goles a favor<input required type="number" min="0" max="99" value={gf} onChange={e=>setGf(e.target.value)}/></label><label>Goles en contra<input required type="number" min="0" max="99" value={ga} onChange={e=>setGa(e.target.value)}/></label>
   <fieldset><legend>Jugadores participantes</legend>{players.filter(p=>(roster[game.tournamentId]??[]).includes(p.id)||game.participants.includes(p.id)).map(p=><label key={p.id}><input type="checkbox" checked={participants.includes(p.id)} onChange={e=>setParticipants(e.target.checked?[...participants,p.id]:participants.filter(x=>x!==p.id))}/><PlayerFace id={p.id}/>{p.name} · #{p.number}</label>)}</fieldset>
   <p>No se puede retirar a alguien que valoró o recibió valoraciones. Antes de retirar a un jugador, elimina o reasigna sus acciones.</p><button disabled={busy||!participants.length}>Guardar cambios</button>
  </form><h3>Corregir acciones</h3><p>Al corregir o eliminar una acción se retira su ajuste de las valoraciones anteriores; las demás notas se conservan.</p>
  {game.events.length===0?<p>No hay acciones registradas.</p>:<div className="account-form"><label>Acción<select value={eventId} onChange={e=>{const event=game.events.find(v=>v.id===e.target.value);setEventId(e.target.value);if(event){setPlayer(event.playerId);setKind(event.kind);setContext(event.context??"");}}}><option value="">Selecciona una acción</option>{game.events.map(ev=><option key={ev.id} value={ev.id}>{eventRules[ev.kind].label} · {players.find(p=>p.id===ev.playerId)?.name}{ev.context?` · ${ev.context}`:""}</option>)}</select></label>
   {eventId&&<><label>Jugador<select value={player} onChange={e=>setPlayer(e.target.value)}>{players.filter(p=>game.participants.includes(p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Tipo<select value={kind} onChange={e=>setKind(e.target.value as MatchEventKind)}>{(Object.keys(eventRules) as MatchEventKind[]).map(k=><option key={k} value={k}>{eventRules[k].label}</option>)}</select></label><label>Contexto<textarea maxLength={280} value={context} onChange={e=>setContext(e.target.value)}/></label><button type="button" disabled={busy} onClick={()=>void saveEvent(false)}>Guardar acción</button><button type="button" disabled={busy} onClick={()=>void saveEvent(true)}>Eliminar acción</button></>}</div>}
  <div className="delete-team-panel"><h3>Eliminar partido</h3><p>Se eliminarán el partido, sus acciones, valoraciones y comentarios. Esta acción es permanente.</p><label>Escribe el nombre del rival ({game.opponent}) para confirmar<input value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label><button type="button" className="delete-team-button" disabled={busy||confirmation!==game.opponent} onClick={()=>void deleteMatch()}>Eliminar partido</button></div></>}
  <p role="status">{message}</p>
 </details>;
}

