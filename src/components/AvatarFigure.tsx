import type { AvatarStyle } from "../domain/visuals";
import { useId } from "react";
import { clampPhotoPosition } from "../domain/visuals";

export default function AvatarFigure({ avatar, photo, className = "" }: { avatar: AvatarStyle; photo?: string | null; className?: string }) {
  const faceClip = useId();
  return <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Avatar del jugador">
    <circle cx="32" cy="32" r="31" fill="#e7f2dd" />
    <defs><clipPath id={faceClip}><circle cx="32" cy="24" r="20" /></clipPath></defs>
    <path d="M14 62c1-12 7-19 18-19s17 7 18 19" fill={avatar.shirt} />
    <path d="M27 40h10v9c-3 3-7 3-10 0z" fill={avatar.skin} />
    {photo && avatar.usePhoto !== false ? <><circle cx="32" cy="24" r="21" fill="#fff" /><image href={photo} x={6 + clampPhotoPosition(avatar.photoX) * 6} y={-2 + clampPhotoPosition(avatar.photoY) * 6} width="52" height="52" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${faceClip})`} /></> : <>
      {avatar.style === "long" && <path d="M12 25C12 9 20 3 32 3s20 6 20 22v16H12z" fill={avatar.hair} />}
      <ellipse cx="32" cy="24" rx="19" ry="20" fill={avatar.skin} />
      {(avatar.style === "short" || avatar.style === "long") && <path d="M13 23C12 9 20 3 32 3s20 6 19 20c-4-3-7-10-10-11-7 5-16 7-28 7z" fill={avatar.hair} />}
      {avatar.style === "curly" && <path d="M13 22c-4-4-1-8 3-9-1-5 4-7 7-6 2-5 7-5 10-3 4-3 8-1 10 2 5-1 8 3 7 7 5 2 5 7 1 10-3-2-4-5-5-7-3 2-6 2-9 0-3 3-6 3-9 1-3 3-7 2-9 0-1 2-3 4-6 5z" fill={avatar.hair} />}
      {avatar.style === "spiky" && <path d="M13 23l-1-11 7 3-1-10 9 6 5-10 5 9 9-5-1 10 8-2-2 11-6-7c-10 3-21 3-32 6z" fill={avatar.hair} />}
      {avatar.style === "side" && <path d="M13 24C11 9 20 3 32 3s20 7 19 21c-5-3-6-7-7-11-7 2-17 1-25-3 1 5-1 10-6 14z" fill={avatar.hair} />}
      <circle cx="25" cy="25" r="1.7" fill="#243027" /><circle cx="39" cy="25" r="1.7" fill="#243027" />
      <path d="M27 34c3 2 7 2 10 0" fill="none" stroke="#623d30" strokeWidth="1.6" strokeLinecap="round" />
    </>}
  </svg>;
}
