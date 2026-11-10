import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { appBaseUrl } from "../domain/app-url";
import ProfileVisualEditor from "./ProfileVisualEditor";

type Player = {
  id: string;
  name: string;
  number: string;
  position: string;
  occupied: boolean;
};
type Claim = { userId: string; playerId: string; email: string; name: string };
type Context = {
  role: string | null;
  playerId: string | null;
  revoked: boolean;
  canClaim: boolean;
  pending: string | null;
  players: Player[];
  linkedAccounts: { playerId: string; email: string }[];
  invite: string | null;
  claims: Claim[];
};
const client = supabase!;
const tokenKey = "la-cancha-invite";
const initialToken = new URLSearchParams(location.hash.slice(1)).get("invite");
if (initialToken) {
  localStorage.setItem(tokenKey, initialToken);
  history.replaceState(null, "", location.pathname + location.search);
}
const token = () => localStorage.getItem(tokenKey);
const appUrl = () => appBaseUrl(import.meta.env.BASE_URL, location.href);
const redirect = () => {
  const url = appUrl();
  url.searchParams.set("account", "1");
  return url.href;
};

export default function Account({ hasTeam = true, teamId = "" }: { hasTeam?: boolean; teamId?: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [recovery, setRecovery] = useState(() =>
    new URLSearchParams(location.search).has("recovery"),
  );
  async function refresh() {
    const { data, error } = await client.rpc("account_context", {
      invite_code: token(),
    });
    if (error) {
      setMessage(error.message);
      setContext(null);
    } else setContext(data as Context);
  }
  useEffect(() => {
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, s) => {
      if (active) {
        setSession(s);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    setContext(null);
    if (session && hasTeam) void refresh();
  }, [session?.user.id, hasTeam]);
  async function run(
    fn: () => PromiseLike<{ error: { message: string } | null }>,
    success: string,
    reload = false,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await fn();
      if (error)
        setMessage(
          error.message.includes("For security purposes")
            ? "Espera unos segundos antes de volver a solicitar un correo."
            : error.message,
        );
      else {
        setMessage(success);
        if (reload) await refresh();
      }
    } catch {
      setMessage("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  if (!session)
    return (
      <section className="panel connected-panel">
        <div className="section-heading">
          <div>
            <h2>Entrar al equipo</h2>
            <p>Usa tu correo y contraseña para acceder.</p>
          </div>
        </div>
        <div className="account-form">
          <label>
            Correo
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="account-actions">
            <button
              disabled={busy || !email || !password}
              onClick={() =>
                void run(
                  () => client.auth.signInWithPassword({ email, password }),
                  "Sesión iniciada.",
                )
              }
            >
              Iniciar sesión
            </button>
            <button
              disabled={busy || !email || !password}
              onClick={() =>
                void run(
                  () =>
                    client.auth.signUp({
                      email,
                      password,
                      options: { emailRedirectTo: redirect() },
                    }),
                  "Revisa tu correo para confirmar la cuenta.",
                )
              }
            >
              Crear cuenta
            </button>
            <button
              disabled={busy || !email}
              onClick={() =>
                void run(
                  () =>
                    client.auth.resetPasswordForEmail(email, {
                      redirectTo: redirect() + "&recovery=1",
                    }),
                  "Revisa tu correo para recuperar la contraseña.",
                )
              }
            >
              Recuperar contraseña
            </button>
          </div>
        </div>
        <p role="status">{message}</p>
      </section>
    );
  if (recovery)
    return (
      <section className="panel connected-panel">
        <h2>Elige una contraseña nueva</h2>
        <div className="account-form">
          <label>
            Nueva contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !password}
            onClick={() =>
              void run(async () => {
                const result = await client.auth.updateUser({ password });
                if (!result.error) {
                  setRecovery(false);
                  history.replaceState(
                    null,
                    "",
                    location.pathname + "?account=1",
                  );
                  setPassword("");
                }
                return result;
              }, "Contraseña actualizada.")
            }
          >
            Guardar contraseña
          </button>
        </div>
        <p role="status">{message}</p>
      </section>
    );
  if (!hasTeam)
    return <section className="panel connected-panel"><h2>Mi cuenta</h2><p>{session.user.email}</p><p>Crea un equipo o abre una invitación para continuar.</p><button className="text-button" onClick={() => void client.auth.signOut()}>Cerrar sesión</button></section>;
  return (
    <section className="panel connected-panel">
      <div className="section-heading">
        <div>
          <h2>Mi cuenta</h2>
          <p>{session.user.email}</p>
        </div>
        <button
          className="text-button"
          onClick={() => void client.auth.signOut()}
        >
          Cerrar sesión
        </button>
      </div>
      {!context && <p>Consultando tu vínculo con el equipo…</p>}
      {context && (
        <>
          <p>
            {context.revoked
              ? "Tu acceso al equipo fue revocado."
              : context.role === "admin"
                ? "Administrador del equipo"
                : context.playerId
                  ? "Cuenta vinculada al equipo"
                  : "Tu cuenta aún no está vinculada."}
          </p>
          {context.playerId && (
            <p>
              Tu ficha:{" "}
              <strong>
                {context.players.find((p) => p.id === context.playerId)?.name}
              </strong>
            </p>
          )}
          {context.playerId && <ProfileVisualEditor team={teamId} player={context.playerId} />}
          {context.pending && (
            <>
              <p>Solicitud pendiente de aprobación.</p>
              <button className="text-button" onClick={() => void refresh()}>
                Actualizar estado
              </button>
            </>
          )}
          {context.canClaim && !context.playerId && (
            <div className="account-form">
              <label>
                Esta es mi ficha
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">Selecciona un jugador</option>
                  {context.players.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.occupied}>
                      {p.name} · #{p.number}
                      {p.occupied ? " · ocupada" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy || !selected}
                onClick={() =>
                  void run(
                    () =>
                      client.rpc("account_request", {
                        player: selected,
                        invite_code: token(),
                      }),
                    "Solicitud enviada.",
                    true,
                  )
                }
              >
                Solicitar vinculación
              </button>
            </div>
          )}
          {!context.canClaim && !context.revoked && (
            <p>
              Abre el enlace de invitación del administrador para solicitar tu
              ficha.
            </p>
          )}
          {context.role === "admin" && (
            <>
              <h3>Invitación al equipo</h3>
              <p>
                Comparte este enlace con los jugadores. Cada enlace vence a los
                siete días.
              </p>
              <input
                className="account-link"
                readOnly
                value={appUrl().href + "#invite=" + context.invite}
              />
              <button
                disabled={busy}
                onClick={() =>
                  void run(
                    () => client.rpc("account_new_invite"),
                    "Nuevo enlace generado; el anterior ya no funciona.",
                    true,
                  )
                }
              >
                Generar nuevo enlace
              </button>
              <h3>Solicitudes</h3>
              {context.claims.length === 0 && (
                <p>No hay solicitudes pendientes.</p>
              )}
              {context.claims.map((c) => (
                <div key={c.userId} className="account-request">
                  <span>
                    {c.email} solicita {c.name}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          client.rpc("account_decide", {
                            claimant: c.userId,
                            approve: true,
                          }),
                        "Solicitud aprobada.",
                        true,
                      )
                    }
                  >
                    Aprobar
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          client.rpc("account_decide", {
                            claimant: c.userId,
                            approve: false,
                          }),
                        "Solicitud rechazada.",
                        true,
                      )
                    }
                  >
                    Rechazar
                  </button>
                </div>
              ))}
              <h3>Fichas vinculadas</h3>
              {context.players
                .filter((p) => p.occupied)
                .map((p) => (
                  <div className="account-request" key={p.id}>
                    <span>
                      {p.name} ·{" "}
                      {
                        context.linkedAccounts.find(
                          (entry) => entry.playerId === p.id,
                        )?.email
                      }
                    </span>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => client.rpc("account_unlink", { player: p.id }),
                          "Ficha desvinculada.",
                          true,
                        )
                      }
                    >
                      Desvincular
                    </button>
                    {p.id !== context.playerId && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Retirar el acceso de la cuenta vinculada a ${p.name}?`,
                            )
                          )
                            void run(
                              () =>
                                client.rpc("account_remove_player", {
                                  player: p.id,
                                }),
                              "Acceso retirado.",
                              true,
                            );
                        }}
                      >
                        Retirar acceso
                      </button>
                    )}
                  </div>
                ))}
            </>
          )}
        </>
      )}
      <p role="status">{message}</p>
      <p className="panel-footnote">
        Tu ficha y tus permisos corresponden al equipo seleccionado.
      </p>
    </section>
  );
}
