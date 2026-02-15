import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { action, token, signature_data, booking_id } = await req.json();

    if (action === "get") {
      // Get document by signing token (public access)
      const { data, error } = await supabase
        .from("document_signatures")
        .select("*")
        .eq("signing_token", token)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "מסמך לא נמצא" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sign") {
      // Sign a document by token
      if (!token || !signature_data) {
        return new Response(JSON.stringify({ error: "חתימה חסרה" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: doc, error: fetchError } = await supabase
        .from("document_signatures")
        .select("*")
        .eq("signing_token", token)
        .eq("status", "pending")
        .single();

      if (fetchError || !doc) {
        return new Response(JSON.stringify({ error: "מסמך לא נמצא או כבר נחתם" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update with signature
      const { error: updateError } = await supabase
        .from("document_signatures")
        .update({
          status: "signed",
          signature_data,
          signed_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      if (updateError) throw updateError;

      // Update booking document status
      const fieldMap: Record<string, string> = {
        contract: "contract_signed",
        waiver: "waiver_signed",
        declaration: "declaration_signed",
      };
      const field = fieldMap[doc.document_type];
      if (field) {
        await supabase
          .from("bookings")
          .update({ [field]: true })
          .eq("id", doc.booking_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      // Create signing documents for a booking (requires auth)
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!booking_id) {
        return new Response(JSON.stringify({ error: "booking_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get booking details
      const { data: booking } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", booking_id)
        .single();

      if (!booking) {
        return new Response(JSON.stringify({ error: "booking not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get customer
      let customer = null;
      if (booking.customer_id) {
        const { data: c } = await supabase
          .from("customers")
          .select("*")
          .eq("id", booking.customer_id)
          .single();
        customer = c;
      }

      // Get vehicle
      let vehicle = null;
      if (booking.vehicle_id) {
        const { data: v } = await supabase
          .from("vehicles")
          .select("*")
          .eq("id", booking.vehicle_id)
          .single();
        vehicle = v;
      }

      const rentalDetails = {
        start_date: booking.start_date,
        end_date: booking.end_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        rental_cost: booking.rental_cost,
        deposit_amount: booking.deposit_amount,
        credit_hold: booking.credit_hold,
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : booking.customer_name,
        customer_id_number: customer?.id_number,
        customer_phone: customer?.phone,
        customer_address: customer?.address,
        vehicle_plate: vehicle?.license_plate,
        vehicle_manufacturer: vehicle?.manufacturer,
        vehicle_model: vehicle?.model,
        vehicle_year: vehicle?.year,
        vehicle_color: vehicle?.color,
      };

      const docTypes = ["contract", "waiver", "declaration"];
      const results = [];

      for (const docType of docTypes) {
        // Upsert - if exists, keep; if not, create
        const { data: existing } = await supabase
          .from("document_signatures")
          .select("*")
          .eq("booking_id", booking_id)
          .eq("document_type", docType)
          .single();

        if (existing) {
          // Update rental details but keep existing status
          await supabase
            .from("document_signatures")
            .update({
              rental_details: rentalDetails,
              customer_name: rentalDetails.customer_name,
              vehicle_details: booking.vehicle_details,
            })
            .eq("id", existing.id);
          results.push(existing);
        } else {
          const { data: newDoc, error } = await supabase
            .from("document_signatures")
            .insert({
              booking_id,
              document_type: docType,
              customer_id: booking.customer_id,
              customer_name: rentalDetails.customer_name,
              vehicle_details: booking.vehicle_details,
              rental_details: rentalDetails,
            })
            .select()
            .single();

          if (error) throw error;
          results.push(newDoc);
        }
      }

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "invalid action" }), {
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
