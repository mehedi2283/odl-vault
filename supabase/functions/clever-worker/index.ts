import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: any;

serve(async (req) => {
 if (req.method === 'HEAD') {
    return new Response(null, { status: 200 })
  }

  const url = new URL(req.url)
  
  // 1. Get Webhook Key from URL parameter (Secure Public Key)
  const webhook_key = url.searchParams.get('key')
  
  // Backwards compatibility for old 'fid' param
  const legacy_fid = url.searchParams.get('fid')
  
  let form_id = legacy_fid;

  try {
    if (req.method !== 'POST') {
       return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { "Content-Type": "application/json" } })
    }

    // 2. Parse Incoming JSON Payload
    const json = await req.json()
    
    // 3. Init Supabase Client (Service Role for admin access)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Validate Key & Retrieve Internal Form ID & Status
    if (webhook_key) {
        const { data: form, error: lookupError } = await supabase
            .from('forms')
            .select('id, status')
            .eq('webhook_key', webhook_key)
            .single()

        if (lookupError || !form) {
            return new Response(JSON.stringify({ error: 'Invalid or inactive webhook key' }), { status: 403, headers: { "Content-Type": "application/json" } })
        }
        
        // STRICT CHECK: Only accept if status is 'active'
        if (form.status !== 'active') {
             return new Response(JSON.stringify({ error: 'Form is inactive (Draft Mode)' }), { status: 423, headers: { "Content-Type": "application/json" } })
        }

        form_id = form.id;
    } 
    
    if (!form_id) {
         return new Response(JSON.stringify({ error: 'Missing webhook identification (key)' }), { status: 400, headers: { "Content-Type": "application/json" } })
    }

    // 5. Store Data securely using Internal ID
    // Note: We only store raw payload here. Mapping happens in the Dashboard or via a separate Trigger if needed.
    const { error } = await supabase
      .from('form_submissions')
      .insert({
        form_id: form_id,
        payload: json,
        source: req.headers.get('referer') || 'Direct API',
        ip_address: req.headers.get('x-forwarded-for') || 'Hidden',
        status: 'pending'
      })

    if (error) throw error

    return new Response(JSON.stringify({ success: true, id: form_id }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    })
  }
})