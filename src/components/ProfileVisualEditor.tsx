import { useEffect, useRef, useState } from "react";
import { rawSupabase } from "../supabase";
import { clampPhotoPosition, defaultAvatar, prepareImage } from "../domain/visuals";
import type { AvatarStyle, Visuals } from "../domain/visuals";
import AvatarFigure from "./AvatarFigure";

const choices = {
  skin: ["#f2c6a0", "#d99568", "#8d5235", "#5c3828"],
  hair: ["#241811", "#5b3421", "#9a6d38", "#ded0aa"],
  shirt: ["#17623e", "#173c74", "#b63131", "#e6b931", "#ef7a27", "#7b3e9d", "#1d8790", "#181f25", "#f3f4ef", "#e35f8e", "#77943d", "#69a7dc"],
};
const colorNames = {
  skin: ["clara", "media", "morena", "oscura"],
  hair: ["negro", "castaño oscuro", "castaño claro", "rubio"],
  shirt: ["verde", "azul oscuro", "rojo", "amarillo", "naranja", "morado", "turquesa", "negro", "blanco", "rosa", "verde oliva", "celeste"],
};
export default function ProfileVisualEditor({ team, player, coach = false }: { team: string; player: string; coach?: boolean }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<AvatarStyle>(defaultAvatar);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; width: number } | null>(null);
  useEffect(() => {
    let active = true; setReady(false);
    void rawSupabase!.rpc(coach ? "multi_coach_visuals" : "multi_visuals", { team }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setMessage("No se pudo cargar tu perfil visual."); return; }
      const current = coach ? (data as { id: string; photo: string | null; avatar: AvatarStyle | null }[]).find(item => item.id === player) : (data as Visuals).players[player];
      setPhoto(current?.photo ?? null); setAvatar(current?.avatar ?? defaultAvatar); setReady(true);
    });
    return () => { active = false; };
  }, [team, player, coach]);
  async function upload(file?: File) {
    if (!file) return;
    try { setPhoto(await prepareImage(file)); setMessage("Foto preparada. Guarda los cambios para aplicarla."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "No se pudo procesar la imagen."); }
  }
  async function save() {
    setBusy(true); setMessage("");
    try {
      const { error } = await rawSupabase!.rpc(coach ? "multi_set_coach_visuals" : "multi_set_profile_visuals", { team, photo, avatar });
      setMessage(error ? error.message : "Foto y avatar guardados.");
    } catch { setMessage("No se pudo conectar. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <details className="profile-visual-editor"><summary>{coach ? "Personalizar mi perfil de entrenador" : "Personalizar mi perfil de jugador"}</summary>
    <div className="profile-visual-grid">
      <div><h3>Mi foto</h3>{photo ? <img className="profile-photo" src={photo} alt="Tu foto de perfil" /> : <div className="profile-photo-placeholder">Sin foto</div>}
        <label className="visual-upload">Elegir foto<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!ready} onChange={e => void upload(e.target.files?.[0])} /></label>
        {photo && <button type="button" className="text-button" onClick={() => setPhoto(null)}>Quitar foto</button>}
      </div>
      <div><h3>Mi avatar</h3><div className={`avatar-preview-drag ${photo && avatar.usePhoto !== false ? "can-drag" : ""}`}
        onPointerDown={e => { if (!photo || avatar.usePhoto === false) return; drag.current = { x: e.clientX, y: e.clientY, startX: clampPhotoPosition(avatar.photoX), startY: clampPhotoPosition(avatar.photoY), width: e.currentTarget.getBoundingClientRect().width }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { const d = drag.current; if (!d) return; setAvatar(previous => ({ ...previous, photoX: clampPhotoPosition(d.startX + (e.clientX - d.x) / d.width * 5), photoY: clampPhotoPosition(d.startY + (e.clientY - d.y) / d.width * 5) })); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <AvatarFigure avatar={avatar} photo={photo} className="profile-avatar-preview" />
      </div>
        <label className="avatar-photo-choice"><input type="checkbox" checked={avatar.usePhoto !== false} onChange={e => setAvatar({ ...avatar, usePhoto: e.target.checked })} /> Usar mi foto de perfil</label>
        {!photo && avatar.usePhoto !== false && <p>Sube una foto para verla en el avatar.</p>}
        {photo && avatar.usePhoto !== false && <p>La foto reemplaza el rostro y el peinado dibujados.</p>}
        {photo && avatar.usePhoto !== false && <div className="photo-position-controls"><p>Arrastra la foto o ajusta su posición:</p>
          <label>Horizontal<input type="range" min="-1" max="1" step="0.05" value={clampPhotoPosition(avatar.photoX)} onChange={e => setAvatar({ ...avatar, photoX: Number(e.target.value) })} /></label>
          <label>Vertical<input type="range" min="-1" max="1" step="0.05" value={clampPhotoPosition(avatar.photoY)} onChange={e => setAvatar({ ...avatar, photoY: Number(e.target.value) })} /></label>
          <button type="button" className="text-button" onClick={() => setAvatar({ ...avatar, photoX: 0, photoY: 0 })}>Centrar foto</button>
        </div>}
        {(["skin", "hair", "shirt"] as const).map(key => <fieldset className="avatar-palette" key={key}><legend>{key === "skin" ? "Piel" : key === "hair" ? "Cabello" : "Camiseta"}</legend><div>{choices[key].map((color, index) => <button key={color} type="button" className="color-swatch" title={colorNames[key][index]} aria-label={`${key === "skin" ? "Piel" : key === "hair" ? "Cabello" : "Camiseta"}: ${colorNames[key][index]}`} aria-pressed={avatar[key] === color} style={{ backgroundColor: color }} onClick={() => setAvatar({ ...avatar, [key]: color })} />)}</div></fieldset>)}
        <label className="avatar-option">Peinado<select value={avatar.style} onChange={e => setAvatar({ ...avatar, style: e.target.value as AvatarStyle["style"] })}><option value="short">Corto</option><option value="long">Largo</option><option value="curly">Rizado</option><option value="spiky">Puntas</option><option value="side">De lado</option><option value="none">Sin cabello</option></select></label>
      </div>
    </div>
    <button type="button" className="lab-primary-button" disabled={!ready || busy} onClick={() => void save()}>Guardar foto y avatar</button>
    <p role="status">{message}</p>
  </details>;
}

