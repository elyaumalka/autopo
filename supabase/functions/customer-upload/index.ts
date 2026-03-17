import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, token, file_data, file_name, side } = await req.json();

    if (action === "get-customer") {
      // Fetch customer by upload token (only public fields)
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, license_front_url, license_back_url")
        .eq("upload_token", token)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "קישור לא תקין" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upload-license") {
      if (!token || !file_data || !side) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate token
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .select("id")
        .eq("upload_token", token)
        .single();

      if (custErr || !customer) {
        return new Response(JSON.stringify({ error: "קישור לא תקין" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Decode base64 and upload
      const base64Data = file_data.split(",")[1] || file_data;
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      const ext = file_name?.split(".").pop() || "jpg";
      const fileName = `licenses/${customer.id}-${side}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("customer-documents")
        .upload(fileName, binaryData, { contentType: `image/${ext}`, upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("customer-documents")
        .getPublicUrl(fileName);

      // Update customer record
      const updateField = side === "front" ? "license_front_url" : "license_back_url";
      const { error: updateErr } = await supabase
        .from("customers")
        .update({ [updateField]: urlData.publicUrl })
        .eq("id", customer.id);

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ url: urlData.publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
