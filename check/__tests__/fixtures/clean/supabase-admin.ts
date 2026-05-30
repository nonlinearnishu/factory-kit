import { createClient } from "@supabase/supabase-js";

// CLEAN: admin client wrapped in a function, never a module-scope singleton.
export function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
