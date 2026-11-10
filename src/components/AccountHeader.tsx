import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { PlayerFace } from "./PlayerIdentity";

export default function AccountHeader({ onOpen }: { onOpen: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const client = supabase!;
    client.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoaded(true);
      }
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, value) => {
      if (active) {
        setSession(value);
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
    setName("");
    if (!session) return;
    const load = () =>
      supabase!
        .rpc("account_context", { invite_code: null })
        .then(({ data, error }) => {
          if (!active || error || !data) return;
          const profile = data as {
            playerId: string | null;
            players: { id: string; name: string }[];
          };
          setName(
            profile.players.find((player) => player.id === profile.playerId)
              ?.name ?? "",
          );
          setPlayerId(profile.playerId);
        });
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session?.user.id]);
  if (!loaded) return null;
  return (
    <button
      className="header-account"
      onClick={onOpen}
      title={session?.user.email ?? undefined}
    >
      {session ? (
        <>
          {playerId && <PlayerFace id={playerId} className="header-profile-photo" />}
          <span>Mi cuenta</span>
          <strong>{name || session.user.email || "Cuenta"}</strong>
        </>
      ) : (
        <strong>Iniciar sesión / Crear cuenta</strong>
      )}
    </button>
  );
}
