import { createClient } from "@supabase/supabase-js";

// Only the publishable key belongs in the browser. Never use a secret key here.
const url = import.meta.env.VITE_SUPABASE_URL || "https://gaedmgckfdvlmotlrlaf.supabase.co";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_bSRk2nrn-VELGKOsaGgM7Q_U8rHkYMZ";

export const rawSupabase =
  url && key && key.startsWith("sb_publishable_")
    ? createClient(url, key)
    : null;

let activeTeam = "";
export function setActiveTeam(team: string) { activeTeam = team; }

// All old screen calls are routed through team-scoped, server-checked RPCs.
const names: Record<string, string> = {
  account_context: "multi_account_context", account_request: "multi_request_player",
  account_decide: "multi_decide_claim", account_new_invite: "multi_new_invite",
  account_unlink: "multi_unlink_player", account_remove_player: "multi_unlink_player",
  sports_data: "multi_sports_data", sports_create_tournament: "multi_create_tournament",
  sports_create_match: "multi_create_match", sports_add_event: "multi_add_event",
  sports_open_ratings: "multi_open_ratings", sports_enroll_player: "multi_enroll_player",
  sports_create_roster_player: "multi_create_roster_player", rating_results: "multi_rating_results",
  rating_mine: "multi_rating_mine", rating_submit: "multi_rating_submit",
  lineup_data: "multi_lineup_data", lineup_submit: "multi_lineup_submit",
};
export const supabase = rawSupabase && new Proxy(rawSupabase, {
  get(target, property, receiver) {
    if (property !== "rpc") return Reflect.get(target, property, receiver);
    return (name: string, args: Record<string, unknown> = {}) => {
      const mapped = names[name];
      if (!mapped) return target.rpc(name, args);
      const extra = name === "account_remove_player" ? { remove_access: true } : name === "account_unlink" ? { remove_access: false } : {};
      return target.rpc(mapped, { ...args, ...extra, team: activeTeam });
    };
  },
});
