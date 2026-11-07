import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente com a chave secreta: só para ações de administrador no servidor. */
export function clienteAdmin() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
