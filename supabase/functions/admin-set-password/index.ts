import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
        throw new Error("Server Misconfiguration: Missing Environment Variables");
    }

    // 1. Initialize Client with user's Auth Header (to verify who is calling)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        throw new Error("Missing Authorization Header");
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    // 2. Verify Requestor is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized: Invalid Token');

    // 3. Verify Requestor is Grand Admin
    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single()
    
    if (profile?.role !== 'grand_admin') {
        // Return 200 with error so client can parse the message
        return new Response(JSON.stringify({ error: 'Insufficient Clearance: Grand Admin Required' }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
    }

    // 4. Initialize Admin Client (Service Role) - This has power to change passwords
    // Disable auth persistence for admin client
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const body = await req.json();
    const { userId, newPassword, requestId } = body;
    
    if (!userId || !newPassword) throw new Error("Missing parameters: userId or newPassword");

    // 5. Update user password
    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) throw updateError

    // 6. If this was a request from the DB, mark it resolved
    if (requestId) {
        await supabaseAdmin.from('password_resets').update({ status: 'resolved' }).eq('id', requestId)
    }

    return new Response(JSON.stringify({ success: true, user: data.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    console.error("Edge Function Error:", error.message);
    // Return 200 so the client can read the error message
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  }
})