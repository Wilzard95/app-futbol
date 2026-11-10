import type { AvatarStyle } from "../domain/visuals";
import { useId } from "react";

export default function AvatarFigure({ avatar, photo, className = "" }: { avatar: AvatarStyle; photo?: string | null; className?: string }) {
  const faceClip = useId();
  return <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Avatar del jugador">
    <circle cx="32" cy="32" r="31" fill="#e7f2dd" />
    <defs><clipPath id={faceClip}><circle cx="32" cy="24" r="20" /></clipPath></defs>
    <path d="M14 62c1-12 7-19 18-19s17 7 18 19" fill={avatar.shirt} />
    <path d="M27 40h10v9c-3 3-7 3-10 0z" fill={avatar.skin} />
    {photo ? <><circle cx="32" cy="24" r="21" fill="#fff" /><image href={photo} x="12" y="4" width="40" height="40" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${faceClip})`} /></> : <>
      {avatar.style === "long" && <path d="M12 25C12 9 20 3 32 3s20 6 20 22v16H12z" fill={avatar.hair} />}
      <ellipse cx="32" cy="24" rx="19" ry="20" fill={avatar.skin} />
      {avatar.style !== "none" && <path d="M13 23C12 9 20 3 32 3s20 6 19 20c-4-3-7-10-10-11-7 5-16 7-28 7z" fill={avatar.hair} />}
      <circle cx="25" cy="25" r="1.7" fill="#243027" /><circle cx="39" cy="25" r="1.7" fill="#243027" />
      <path d="M27 34c3 2 7 2 10 0" fill="none" stroke="#623d30" strokeWidth="1.6" strokeLinecap="round" />
    </>}
  </svg>;
}
