import { supabase } from "./supabase";

export async function signOut() {
    const signOut = await supabase.auth.signOut()

    return signOut;
}