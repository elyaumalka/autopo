export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accidents: {
        Row: {
          actual_cost: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          damage_photos: Json | null
          date: string
          description: string | null
          estimated_cost: number | null
          id: string
          insurance_claim_number: string | null
          notes: string | null
          other_party_id: string | null
          other_party_name: string | null
          other_party_phone: string | null
          other_vehicle_plate: string | null
          status: Database["public"]["Enums"]["accident_status"]
          type: Database["public"]["Enums"]["accident_type"]
          updated_at: string
          vehicle_details: string | null
          vehicle_id: string
        }
        Insert: {
          actual_cost?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          damage_photos?: Json | null
          date: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          insurance_claim_number?: string | null
          notes?: string | null
          other_party_id?: string | null
          other_party_name?: string | null
          other_party_phone?: string | null
          other_vehicle_plate?: string | null
          status?: Database["public"]["Enums"]["accident_status"]
          type: Database["public"]["Enums"]["accident_type"]
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id: string
        }
        Update: {
          actual_cost?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          damage_photos?: Json | null
          date?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          insurance_claim_number?: string | null
          notes?: string | null
          other_party_id?: string | null
          other_party_name?: string | null
          other_party_phone?: string | null
          other_vehicle_plate?: string | null
          status?: Database["public"]["Enums"]["accident_status"]
          type?: Database["public"]["Enums"]["accident_type"]
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accidents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          billing_rate_amount: number | null
          billing_rate_type: string | null
          collection_date: string | null
          collection_date_type: string | null
          collection_frequency: string | null
          contract_signed: boolean | null
          contract_url: string | null
          created_at: string
          created_by: string | null
          credit_hold: number | null
          customer_id: string | null
          customer_name: string | null
          declaration_signed: boolean | null
          declaration_url: string | null
          deposit_amount: number | null
          end_date: string
          end_time: string | null
          future_payment_method: string | null
          id: string
          notes: string | null
          occupied_slots: Json | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          rental_cost: number | null
          rental_type: Database["public"]["Enums"]["rental_type"] | null
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          sumit_auth_number: string | null
          sumit_authorized_amount: number | null
          sumit_authorized_at: string | null
          updated_at: string
          vehicle_details: string | null
          vehicle_id: string | null
          waiver_signed: boolean | null
          waiver_url: string | null
        }
        Insert: {
          billing_rate_amount?: number | null
          billing_rate_type?: string | null
          collection_date?: string | null
          collection_date_type?: string | null
          collection_frequency?: string | null
          contract_signed?: boolean | null
          contract_url?: string | null
          created_at?: string
          created_by?: string | null
          credit_hold?: number | null
          customer_id?: string | null
          customer_name?: string | null
          declaration_signed?: boolean | null
          declaration_url?: string | null
          deposit_amount?: number | null
          end_date: string
          end_time?: string | null
          future_payment_method?: string | null
          id?: string
          notes?: string | null
          occupied_slots?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          rental_cost?: number | null
          rental_type?: Database["public"]["Enums"]["rental_type"] | null
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          sumit_auth_number?: string | null
          sumit_authorized_amount?: number | null
          sumit_authorized_at?: string | null
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string | null
          waiver_signed?: boolean | null
          waiver_url?: string | null
        }
        Update: {
          billing_rate_amount?: number | null
          billing_rate_type?: string | null
          collection_date?: string | null
          collection_date_type?: string | null
          collection_frequency?: string | null
          contract_signed?: boolean | null
          contract_url?: string | null
          created_at?: string
          created_by?: string | null
          credit_hold?: number | null
          customer_id?: string | null
          customer_name?: string | null
          declaration_signed?: boolean | null
          declaration_url?: string | null
          deposit_amount?: number | null
          end_date?: string
          end_time?: string | null
          future_payment_method?: string | null
          id?: string
          notes?: string | null
          occupied_slots?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          rental_cost?: number | null
          rental_type?: Database["public"]["Enums"]["rental_type"] | null
          start_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          sumit_auth_number?: string | null
          sumit_authorized_amount?: number | null
          sumit_authorized_at?: string | null
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string | null
          waiver_signed?: boolean | null
          waiver_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_tasks: {
        Row: {
          amount: number
          call_history: Json | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          debt_date: string | null
          id: string
          notes: string | null
          paid_amount: number | null
          payment_due_date: string | null
          reason: string | null
          reminder_date: string | null
          rental_id: string | null
          status: Database["public"]["Enums"]["collection_status"]
          updated_at: string
          vehicle_details: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          call_history?: Json | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          debt_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          payment_due_date?: string | null
          reason?: string | null
          reminder_date?: string | null
          rental_id?: string | null
          status?: Database["public"]["Enums"]["collection_status"]
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          call_history?: Json | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          debt_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          payment_due_date?: string | null
          reason?: string | null
          reminder_date?: string | null
          rental_id?: string | null
          status?: Database["public"]["Enums"]["collection_status"]
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_tasks_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_tasks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_documents: {
        Row: {
          created_at: string
          customer_id: string
          document_name: string
          document_type: string
          file_url: string
          id: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          document_name: string
          document_type?: string
          file_url: string
          id?: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          document_name?: string
          document_type?: string
          file_url?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          card_expiry: string | null
          card_last4: string | null
          city: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          id_number: string
          is_foreign: boolean
          last_name: string
          license_back_url: string | null
          license_expiry: string | null
          license_front_url: string | null
          license_issue_date: string | null
          license_number: string | null
          notes: string | null
          passport_url: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_provider: string | null
          payment_token: string | null
          phone: string
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          upload_token: string | null
        }
        Insert: {
          address?: string | null
          card_expiry?: string | null
          card_last4?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          id_number: string
          is_foreign?: boolean
          last_name: string
          license_back_url?: string | null
          license_expiry?: string | null
          license_front_url?: string | null
          license_issue_date?: string | null
          license_number?: string | null
          notes?: string | null
          passport_url?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_provider?: string | null
          payment_token?: string | null
          phone: string
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          upload_token?: string | null
        }
        Update: {
          address?: string | null
          card_expiry?: string | null
          card_last4?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          id_number?: string
          is_foreign?: boolean
          last_name?: string
          license_back_url?: string | null
          license_expiry?: string | null
          license_front_url?: string | null
          license_issue_date?: string | null
          license_number?: string | null
          notes?: string | null
          passport_url?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_provider?: string | null
          payment_token?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          upload_token?: string | null
        }
        Relationships: []
      }
      document_signatures: {
        Row: {
          booking_id: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          document_type: string
          id: string
          rental_details: Json | null
          signature_data: string | null
          signed_at: string | null
          signed_pdf_url: string | null
          signing_token: string
          status: string
          updated_at: string
          vehicle_details: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          document_type: string
          id?: string
          rental_details?: Json | null
          signature_data?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          signing_token?: string
          status?: string
          updated_at?: string
          vehicle_details?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          document_type?: string
          id?: string
          rental_details?: Json | null
          signature_data?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          signing_token?: string
          status?: string
          updated_at?: string
          vehicle_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          is_recurring: boolean | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          receipt_url: string | null
          type: Database["public"]["Enums"]["expense_type"]
          updated_at: string
          vehicle_details: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receipt_url?: string | null
          type: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receipt_url?: string | null
          type?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      general_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          due_time: string | null
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["priority"]
          reminder_date: string | null
          reminder_time: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: Database["public"]["Enums"]["general_task_type"] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          due_time?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority"]
          reminder_date?: string | null
          reminder_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type?: Database["public"]["Enums"]["general_task_type"] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          due_time?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority"]
          reminder_date?: string | null
          reminder_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: Database["public"]["Enums"]["general_task_type"] | null
          updated_at?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          date: string
          id: string
          invoice_number: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          rental_id: string | null
          type: Database["public"]["Enums"]["income_type"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          date: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          rental_id?: string | null
          type: Database["public"]["Enums"]["income_type"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          date?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          rental_id?: string | null
          type?: Database["public"]["Enums"]["income_type"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incomes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          due_km: number | null
          end_time: string | null
          id: string
          notes: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["task_status"]
          type: Database["public"]["Enums"]["maintenance_type"]
          updated_at: string
          vehicle_details: string | null
          vehicle_id: string
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          due_km?: number | null
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          type: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id: string
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          due_km?: number | null
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number | null
          auth_number: string | null
          booking_id: string | null
          card_last4: string | null
          card_mask: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          error_message: string | null
          id: string
          invoice_id: string | null
          raw_response: Json | null
          rental_id: string | null
          status: string
          transaction_type: string
        }
        Insert: {
          amount?: number | null
          auth_number?: string | null
          booking_id?: string | null
          card_last4?: string | null
          card_mask?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          raw_response?: Json | null
          rental_id?: string | null
          status?: string
          transaction_type: string
        }
        Update: {
          amount?: number | null
          auth_number?: string | null
          booking_id?: string | null
          card_last4?: string | null
          card_mask?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          raw_response?: Json | null
          rental_id?: string | null
          status?: string
          transaction_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rentals: {
        Row: {
          actual_end_date: string | null
          actual_end_time: string | null
          additional_charges: number | null
          additional_charges_details: string | null
          base_cost: number | null
          billing_rate_amount: number | null
          billing_rate_type: string | null
          booking_id: string | null
          collection_date: string | null
          collection_date_type: string | null
          collection_frequency: string | null
          created_at: string
          created_by: string | null
          credit_hold: number | null
          customer_id: string | null
          customer_name: string | null
          end_km: number | null
          extra_km: number | null
          extra_km_cost: number | null
          future_payment_method: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          occupied_slots: Json | null
          paid_amount: number | null
          photos: Json | null
          planned_end_date: string | null
          planned_end_time: string | null
          rate_per_unit: number | null
          remaining_payment: number | null
          rental_type: string | null
          start_date: string
          start_km: number | null
          start_time: string | null
          status: Database["public"]["Enums"]["rental_status"]
          sumit_auth_number: string | null
          sumit_authorized_amount: number | null
          sumit_authorized_at: string | null
          toll_charges: number | null
          total_cost: number | null
          updated_at: string
          vehicle_details: string | null
          vehicle_id: string | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_end_time?: string | null
          additional_charges?: number | null
          additional_charges_details?: string | null
          base_cost?: number | null
          billing_rate_amount?: number | null
          billing_rate_type?: string | null
          booking_id?: string | null
          collection_date?: string | null
          collection_date_type?: string | null
          collection_frequency?: string | null
          created_at?: string
          created_by?: string | null
          credit_hold?: number | null
          customer_id?: string | null
          customer_name?: string | null
          end_km?: number | null
          extra_km?: number | null
          extra_km_cost?: number | null
          future_payment_method?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          occupied_slots?: Json | null
          paid_amount?: number | null
          photos?: Json | null
          planned_end_date?: string | null
          planned_end_time?: string | null
          rate_per_unit?: number | null
          remaining_payment?: number | null
          rental_type?: string | null
          start_date: string
          start_km?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["rental_status"]
          sumit_auth_number?: string | null
          sumit_authorized_amount?: number | null
          sumit_authorized_at?: string | null
          toll_charges?: number | null
          total_cost?: number | null
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string | null
        }
        Update: {
          actual_end_date?: string | null
          actual_end_time?: string | null
          additional_charges?: number | null
          additional_charges_details?: string | null
          base_cost?: number | null
          billing_rate_amount?: number | null
          billing_rate_type?: string | null
          booking_id?: string | null
          collection_date?: string | null
          collection_date_type?: string | null
          collection_frequency?: string | null
          created_at?: string
          created_by?: string | null
          credit_hold?: number | null
          customer_id?: string | null
          customer_name?: string | null
          end_km?: number | null
          extra_km?: number | null
          extra_km_cost?: number | null
          future_payment_method?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          occupied_slots?: Json | null
          paid_amount?: number | null
          photos?: Json | null
          planned_end_date?: string | null
          planned_end_time?: string | null
          rate_per_unit?: number | null
          remaining_payment?: number | null
          rental_type?: string | null
          start_date?: string
          start_km?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["rental_status"]
          sumit_auth_number?: string | null
          sumit_authorized_amount?: number | null
          sumit_authorized_at?: string | null
          toll_charges?: number | null
          total_cost?: number | null
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rentals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      sumit_invoices: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          document_id: string
          document_number: string | null
          document_type: number | null
          document_type_name: string | null
          id: string
          pdf_url: string | null
          raw_response: Json | null
          rental_id: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          document_id: string
          document_number?: string | null
          document_type?: number | null
          document_type_name?: string | null
          id?: string
          pdf_url?: string | null
          raw_response?: Json | null
          rental_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          document_id?: string
          document_number?: string | null
          document_type?: number | null
          document_type_name?: string | null
          id?: string
          pdf_url?: string | null
          raw_response?: Json | null
          rental_id?: string | null
        }
        Relationships: []
      }
      traffic_tickets: {
        Row: {
          amount: number
          company_declaration: boolean | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          date: string
          declaration_url: string | null
          driver_declaration: boolean | null
          id: string
          location: string | null
          notes: string | null
          paid_date: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          updated_at: string
          vehicle_details: string | null
          vehicle_id: string
        }
        Insert: {
          amount: number
          company_declaration?: boolean | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          date: string
          declaration_url?: string | null
          driver_declaration?: boolean | null
          id?: string
          location?: string | null
          notes?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id: string
        }
        Update: {
          amount?: number
          company_declaration?: boolean | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          date?: string
          declaration_url?: string | null
          driver_declaration?: boolean | null
          id?: string
          location?: string | null
          notes?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          updated_at?: string
          vehicle_details?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traffic_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traffic_tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string
          current_km: number | null
          daily_rate: number | null
          extra_km_price: number | null
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null
          half_day_rate: number | null
          hourly_delay_rate: number | null
          id: string
          image_url: string | null
          km_limit: number | null
          license_plate: string
          manufacturer: string
          model: string
          monthly_rate: number | null
          notes: string | null
          sold_date: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          weekly_rate: number | null
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          current_km?: number | null
          daily_rate?: number | null
          extra_km_price?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          half_day_rate?: number | null
          hourly_delay_rate?: number | null
          id?: string
          image_url?: string | null
          km_limit?: number | null
          license_plate: string
          manufacturer: string
          model: string
          monthly_rate?: number | null
          notes?: string | null
          sold_date?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          weekly_rate?: number | null
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          current_km?: number | null
          daily_rate?: number | null
          extra_km_price?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          half_day_rate?: number | null
          hourly_delay_rate?: number | null
          id?: string
          image_url?: string | null
          km_limit?: number | null
          license_plate?: string
          manufacturer?: string
          model?: string
          monthly_rate?: number | null
          notes?: string | null
          sold_date?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          weekly_rate?: number | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      accident_status: "פתוח" | "בטיפול" | "בהמתנה לביטוח" | "נסגר"
      accident_type: "תביעה חיצונית" | "תביעה פנימית"
      app_role: "admin" | "manager" | "employee"
      booking_status: "ממתין" | "מאושר" | "פעיל" | "הושלם" | "בוטל"
      collection_status: "פתוח" | "בטיפול" | "נסגר" | "חלקי"
      customer_status: "פעיל" | "לא פעיל" | "חסום"
      expense_type:
        | "דלק"
        | "טיפול"
        | "ביטוח"
        | "רישוי"
        | "תיקון"
        | "שטיפה"
        | "חניה"
        | "כביש 6"
        | "הוצאה קבועה"
        | "אחר"
      fuel_type: "בנזין" | "דיזל" | "היברידי" | "חשמלי"
      general_task_type: "כללי" | "טלפון" | "פגישה" | "מסמכים" | "אחר"
      income_type:
        | "השכרה"
        | "קילומטרז׳ נוסף"
        | "דוח תנועה"
        | "כביש 6"
        | "נזק"
        | "אחר"
      maintenance_type:
        | "טיפול תקופתי"
        | "החלפת שמן"
        | "צמיגים"
        | "בלמים"
        | "טסט"
        | "חידוש רישוי"
        | "ביטוח"
        | "אחר"
      payment_method: "מזומן" | "אשראי" | "צ׳ק" | "העברה בנקאית" | "ביט"
      payment_status: "לא שולם" | "מקדמה" | "שולם"
      priority: "נמוכה" | "בינונית" | "גבוהה" | "דחוף"
      rental_status: "פעיל" | "הושלם" | "בוטל"
      rental_type:
        | "חצי יום"
        | "24 שעות"
        | "שבוע"
        | "חודש"
        | "יומיים"
        | "שישי-שבת"
      task_status: "ממתין" | "בתהליך" | "הושלם"
      ticket_status: "חדש" | "הועבר ללקוח" | "שולם" | "בערעור"
      vehicle_status: "זמין" | "מושכר" | "בטיפול" | "תאונה" | "לא פעיל" | "נמכר"
      vehicle_type: "5 מקומות" | "7 מקומות"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      accident_status: ["פתוח", "בטיפול", "בהמתנה לביטוח", "נסגר"],
      accident_type: ["תביעה חיצונית", "תביעה פנימית"],
      app_role: ["admin", "manager", "employee"],
      booking_status: ["ממתין", "מאושר", "פעיל", "הושלם", "בוטל"],
      collection_status: ["פתוח", "בטיפול", "נסגר", "חלקי"],
      customer_status: ["פעיל", "לא פעיל", "חסום"],
      expense_type: [
        "דלק",
        "טיפול",
        "ביטוח",
        "רישוי",
        "תיקון",
        "שטיפה",
        "חניה",
        "כביש 6",
        "הוצאה קבועה",
        "אחר",
      ],
      fuel_type: ["בנזין", "דיזל", "היברידי", "חשמלי"],
      general_task_type: ["כללי", "טלפון", "פגישה", "מסמכים", "אחר"],
      income_type: [
        "השכרה",
        "קילומטרז׳ נוסף",
        "דוח תנועה",
        "כביש 6",
        "נזק",
        "אחר",
      ],
      maintenance_type: [
        "טיפול תקופתי",
        "החלפת שמן",
        "צמיגים",
        "בלמים",
        "טסט",
        "חידוש רישוי",
        "ביטוח",
        "אחר",
      ],
      payment_method: ["מזומן", "אשראי", "צ׳ק", "העברה בנקאית", "ביט"],
      payment_status: ["לא שולם", "מקדמה", "שולם"],
      priority: ["נמוכה", "בינונית", "גבוהה", "דחוף"],
      rental_status: ["פעיל", "הושלם", "בוטל"],
      rental_type: ["חצי יום", "24 שעות", "שבוע", "חודש", "יומיים", "שישי-שבת"],
      task_status: ["ממתין", "בתהליך", "הושלם"],
      ticket_status: ["חדש", "הועבר ללקוח", "שולם", "בערעור"],
      vehicle_status: ["זמין", "מושכר", "בטיפול", "תאונה", "לא פעיל", "נמכר"],
      vehicle_type: ["5 מקומות", "7 מקומות"],
    },
  },
} as const
