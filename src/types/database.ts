export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appointment_services: {
        Row: {
          appointment_id: string
          duration_minutes: number
          id: string
          price: number
          service_id: string
        }
        Insert: {
          appointment_id: string
          duration_minutes: number
          id?: string
          price: number
          service_id: string
        }
        Update: {
          appointment_id?: string
          duration_minutes?: number
          id?: string
          price?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_id: string
          created_at: string
          end_at: string
          id: string
          notes: string | null
          professional_id: string
          shop_id: string
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          client_id: string
          created_at?: string
          end_at: string
          id?: string
          notes?: string | null
          professional_id: string
          shop_id: string
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          client_id?: string
          created_at?: string
          end_at?: string
          id?: string
          notes?: string | null
          professional_id?: string
          shop_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          closed: boolean
          created_at: string
          end_time: string | null
          id: string
          shop_id: string
          start_time: string | null
          weekday: number
        }
        Insert: {
          closed?: boolean
          created_at?: string
          end_time?: string | null
          id?: string
          shop_id: string
          start_time?: string | null
          weekday: number
        }
        Update: {
          closed?: boolean
          created_at?: string
          end_time?: string | null
          id?: string
          shop_id?: string
          start_time?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          shop_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          shop_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          phone: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      professionals: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          phone: string | null
          shop_id: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          shop_id: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          shop_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          duration_minutes: number
          id: string
          name: string
          price: number
          shop_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          duration_minutes: number
          id?: string
          name: string
          price: number
          shop_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          address_number: string | null
          address_street: string | null
          avatar_url: string | null
          buffer_minutes: number
          city: string | null
          complement: string | null
          cep: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          neighborhood: string | null
          phone: string | null
          slug: string
          slot_interval_minutes: number
          state: string | null
          timezone: string
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          address_street?: string | null
          avatar_url?: string | null
          buffer_minutes?: number
          city?: string | null
          complement?: string | null
          cep?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          neighborhood?: string | null
          phone?: string | null
          slug: string
          slot_interval_minutes?: number
          state?: string | null
          timezone?: string
        }
        Update: {
          address?: string | null
          address_number?: string | null
          address_street?: string | null
          avatar_url?: string | null
          buffer_minutes?: number
          city?: string | null
          complement?: string | null
          cep?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          neighborhood?: string | null
          phone?: string | null
          slug?: string
          slot_interval_minutes?: number
          state?: string | null
          timezone?: string
        }
        Relationships: []
      }
      barbershops: {
        Row: {
          address: string | null
          address_number: string | null
          address_street: string | null
          avatar_url: string | null
          buffer_minutes: number
          city: string | null
          complement: string | null
          cep: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          neighborhood: string | null
          phone: string | null
          slug: string
          slot_interval_minutes: number
          state: string | null
          timezone: string
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          address_street?: string | null
          avatar_url?: string | null
          buffer_minutes?: number
          city?: string | null
          complement?: string | null
          cep?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          neighborhood?: string | null
          phone?: string | null
          slug: string
          slot_interval_minutes?: number
          state?: string | null
          timezone?: string
        }
        Update: {
          address?: string | null
          address_number?: string | null
          address_street?: string | null
          avatar_url?: string | null
          buffer_minutes?: number
          city?: string | null
          complement?: string | null
          cep?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          neighborhood?: string | null
          phone?: string | null
          slug?: string
          slot_interval_minutes?: number
          state?: string | null
          timezone?: string
        }
        Relationships: []
      }
      client_users: {
        Row: {
          id: string
          user_id: string
          client_id: string
          shop_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client_id: string
          shop_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string
          shop_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off: {
        Row: {
          created_at: string
          end_at: string
          id: string
          professional_id: string | null
          reason: string | null
          shop_id: string
          start_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          shop_id: string
          start_at: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          shop_id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_member_role: { Args: { p_shop_id: string }; Returns: string }
      is_shop_admin: { Args: { p_shop_id: string }; Returns: boolean }
      is_shop_member: { Args: { p_shop_id: string }; Returns: boolean }
      is_client_at_shop: { Args: { p_shop_id: string }; Returns: boolean }
      get_client_id: { Args: { p_shop_id: string }; Returns: string }
      get_available_slots: {
        Args: {
          p_shop_id: string
          p_professional_id: string
          p_date: string
          p_duration_minutes: number
        }
        Returns: { slot_start: string; slot_end: string }[]
      }
      create_appointment_safe: {
        Args: {
          p_shop_id: string
          p_client_id: string
          p_professional_id: string
          p_start_at: string
          p_service_ids: string[]
          p_notes?: string | null
        }
        Returns: {
          appointment_id: string
          start_at: string
          end_at: string
          duration_minutes: number
          buffer_minutes: number
        }[]
      }
      list_public_barbershops_with_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          slug: string
          address: string | null
          neighborhood: string | null
          city: string | null
          state: string | null
          avatar_url: string | null
          services_count: number
          professionals_count: number
          schedule_configured: boolean
          catalog_active: boolean
          can_book: boolean
          missing_reasons: string[]
        }[]
      }
      list_public_barbershops_with_status_filtered: {
        Args: {
          p_city?: string | null
          p_state?: string | null
        }
        Returns: {
          id: string
          name: string
          slug: string
          address: string | null
          neighborhood: string | null
          city: string | null
          state: string | null
          avatar_url: string | null
          services_count: number
          professionals_count: number
          schedule_configured: boolean
          catalog_active: boolean
          can_book: boolean
          missing_reasons: string[]
        }[]
      }
      register_client: {
        Args: {
          p_shop_id: string
          p_name: string
          p_phone?: string | null
          p_email?: string | null
        }
        Returns: string
      }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      member_role: "admin" | "professional" | "reception"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
