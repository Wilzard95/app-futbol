import { createClient } from "@supabase/supabase-js";

// Only the publishable key belongs in the browser. Never use a secret key here.
const url = import.meta.env.VITE_SUPABASE_URL || "https://gaedmgckfdvlmotlrlaf.supabase.co";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_bSRk2nrn-VELGKOsaGgM7Q_U8rHkYMZ";

export const supabase =
  url && key && key.startsWith("sb_publishable_")
    ? createClient(url, key)
    : null;
