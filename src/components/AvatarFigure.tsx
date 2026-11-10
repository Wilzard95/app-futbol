import type { AvatarStyle } from "../domain/visuals";

export default function AvatarFigure({ avatar, className = "" }: { avatar: AvatarStyle; className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Avatar del jugador">
    <circle cx="32" cy="32" r="31" fill="#e7f2dd" />
    {avatar.style === "long" && <path d="M14 28c0-15 7-22 18-22s18 7 18 22v13H14z" fill={avatar.hair} />}
    <path d="M10 62c1-14 8-20 22-20s21 6 22 20" fill={avatar.shirt} />
    <path d="M26 40h12v9c-3 4-9 4-12 0z" fill={avatar.skin} />
    <ellipse cx="32" cy="25" rx="14" ry="17" fill={avatar.skin} />
    {avatar.style !== "none" && <path d="M18 24C17 10 23 6 32 6s15 6 14 18c-3-3-5-9-7-10-6 5-13 6-21 6z" fill={avatar.hair} />}
    <circle cx="27" cy="26" r="1.5" fill="#243027" /><circle cx="37" cy="26" r="1.5" fill="#243027" />
    <path d="M28 33c2 2 6 2 8 0" fill="none" stroke="#623d30" strokeWidth="1.5" strokeLinecap="round" />
  </svg>;
}
