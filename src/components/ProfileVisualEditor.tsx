import { useEffect, useState } from "react";
import { rawSupabase } from "../supabase";
import { defaultAvatar, prepareImage } from "../domain/visuals";
import type { AvatarStyle, Visuals } from "../domain/visuals";
import AvatarFigure from "./AvatarFigure";

const choices = {
  skin: ["#f2c6a0", "#d99568", "#8d5235", "#5c3828"],
  hair: ["#241811", "#5b3421", "#9a6d38", "#ded0aa"],
  shirt: ["#17623e", "#173c74", "#b63131", "#e6b931"],
};
export default function ProfileVisualEditor({ team, player }: { team: string; player: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<AvatarStyle>(defaultAvatar);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true; setReady(false);
    void rawSupabase!.rpc("multi_visuals", { team }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setMessage("No se pudo cargar tu perfil visual."); return; }
      const current = (data as Visuals).players[player];
      setPhoto(current?.photo ?? null); setAvatar(current?.avatar ?? defaultAvatar); setReady(true);
    });
    return () => { active = false; };
  }, [team, player]);
  async function upload(file?: File) {
    if (!file) return;
    try { setPhoto(await prepareImage(file)); setMessage("Foto preparada. Guarda los cambios para aplicarla."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "No se pudo procesar la imagen."); }
  }
  async function save() {
    setBusy(true); setMessage("");
    try {
      const { error } = await rawSupabase!.rpc("multi_set_profile_visuals", { team, photo, avatar });
      setMessage(error ? error.message : "Foto y avatar guardados.");
    } catch { setMessage("No se pudo conectar. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <details className="profile-visual-editor"><summary>Personalizar mi perfil</summary>
    <div className="profile-visual-grid">
      <div><h3>Mi foto</h3>{photo ? <img className="profile-photo" src={photo} alt="Tu foto de perfil" /> : <div className="profile-photo-placeholder">Sin foto</div>}
        <label className="visual-upload">Elegir foto<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!ready} onChange={e => void upload(e.target.files?.[0])} /></label>
        {photo && <button type="button" className="text-button" onClick={() => setPhoto(null)}>Quitar foto</button>}
      </div>
      <div><h3>Mi avatar</h3><AvatarFigure avatar={avatar} photo={photo} className="profile-avatar-preview" />
        {photo && <p>Tu foto aparecerá en la cara del avatar.</p>}
        {(["skin", "hair", "shirt"] as const).map(key => <label className="avatar-option" key={key}>{key === "skin" ? "Piel" : key === "hair" ? "Cabello" : "Camiseta"}<select value={avatar[key]} onChange={e => setAvatar({ ...avatar, [key]: e.target.value })}>{choices[key].map((color, index) => <option key={color} value={color}>Color {index + 1}</option>)}</select></label>)}
        <label className="avatar-option">Peinado<select value={avatar.style} onChange={e => setAvatar({ ...avatar, style: e.target.value as AvatarStyle["style"] })}><option value="short">Corto</option><option value="long">Largo</option><option value="none">Sin cabello</option></select></label>
      </div>
    </div>
    <button type="button" className="lab-primary-button" disabled={!ready || busy} onClick={() => void save()}>Guardar foto y avatar</button>
    <p role="status">{message}</p>
  </details>;
}
