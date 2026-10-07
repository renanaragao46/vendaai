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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_configs: {
        Row: {
          agent_name: string
          created_at: string
          emoji_usage: string
          id: string
          is_active: boolean
          language_rules: string | null
          llm_model: string
          llm_provider: string
          organization_id: string
          personality: string | null
          primary_objective: string | null
          target_audience: string | null
          tone: string | null
          updated_at: string
          words_to_avoid: string[]
          words_to_use: string[]
        }
        Insert: {
          agent_name?: string
          created_at?: string
          emoji_usage?: string
          id?: string
          is_active?: boolean
          language_rules?: string | null
          llm_model?: string
          llm_provider?: string
          organization_id: string
          personality?: string | null
          primary_objective?: string | null
          target_audience?: string | null
          tone?: string | null
          updated_at?: string
          words_to_avoid?: string[]
          words_to_use?: string[]
        }
        Update: {
          agent_name?: string
          created_at?: string
          emoji_usage?: string
          id?: string
          is_active?: boolean
          language_rules?: string | null
          llm_model?: string
          llm_provider?: string
          organization_id?: string
          personality?: string | null
          primary_objective?: string | null
          target_audience?: string | null
          tone?: string | null
          updated_at?: string
          words_to_avoid?: string[]
          words_to_use?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "agent_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_actions: {
        Row: {
          action_type: string
          ai_run_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          organization_id: string
          payload: Json
          status: string
        }
        Insert: {
          action_type: string
          ai_run_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          payload?: Json
          status?: string
        }
        Update: {
          action_type?: string
          ai_run_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          action: string | null
          confidence: number | null
          conversation_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          generated_response: string | null
          id: string
          intent: string | null
          message_id: string | null
          metadata: Json
          model: string | null
          organization_id: string
          provider: string | null
          result: string
          sales_stage: string | null
          temperature: string | null
          validation: Json
        }
        Insert: {
          action?: string | null
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          generated_response?: string | null
          id?: string
          intent?: string | null
          message_id?: string | null
          metadata?: Json
          model?: string | null
          organization_id: string
          provider?: string | null
          result?: string
          sales_stage?: string | null
          temperature?: string | null
          validation?: Json
        }
        Update: {
          action?: string | null
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          generated_response?: string | null
          id?: string
          intent?: string | null
          message_id?: string | null
          metadata?: Json
          model?: string | null
          organization_id?: string
          provider?: string | null
          result?: string
          sales_stage?: string | null
          temperature?: string | null
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          source: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          source?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          source?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_handoffs: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          conversation_id: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          reason: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          conversation_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          reason: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_handoffs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_handoffs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_state: string
          channel: string
          contact_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          organization_id: string
          sales_stage: string
          status: string
          summary: string | null
          temperature: string
          updated_at: string
        }
        Insert: {
          ai_state?: string
          channel?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          organization_id: string
          sales_stage?: string
          status?: string
          summary?: string | null
          temperature?: string
          updated_at?: string
        }
        Update: {
          ai_state?: string
          channel?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          organization_id?: string
          sales_stage?: string
          status?: string
          summary?: string | null
          temperature?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_memories: {
        Row: {
          contact_id: string
          conversation_summary: string | null
          created_at: string
          id: string
          last_interaction_at: string | null
          name: string | null
          objections: string[]
          organization_id: string
          preferences: string[]
          products_of_interest: Json
          purchase_history: Json
          sales_stage: string
          temperature: string
          updated_at: string
          voluntarily_provided: Json
        }
        Insert: {
          contact_id: string
          conversation_summary?: string | null
          created_at?: string
          id?: string
          last_interaction_at?: string | null
          name?: string | null
          objections?: string[]
          organization_id: string
          preferences?: string[]
          products_of_interest?: Json
          purchase_history?: Json
          sales_stage?: string
          temperature?: string
          updated_at?: string
          voluntarily_provided?: Json
        }
        Update: {
          contact_id?: string
          conversation_summary?: string | null
          created_at?: string
          id?: string
          last_interaction_at?: string | null
          name?: string | null
          objections?: string[]
          organization_id?: string
          preferences?: string[]
          products_of_interest?: Json
          purchase_history?: Json
          sales_stage?: string
          temperature?: string
          updated_at?: string
          voluntarily_provided?: Json
        }
        Relationships: [
          {
            foreignKeyName: "customer_memories_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_items: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind: string
          organization_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          organization_id: string
          tag_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          organization_id: string
          tag_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assignee_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          last_interaction_at: string | null
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          organization_id: string
          potential_value: number | null
          product_id: string | null
          stage_id: string | null
          temperature: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          last_interaction_at?: string | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          organization_id: string
          potential_value?: number | null
          product_id?: string | null
          stage_id?: string | null
          temperature?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          last_interaction_at?: string | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          organization_id?: string
          potential_value?: number | null
          product_id?: string | null
          stage_id?: string | null
          temperature?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          external_media_id: string | null
          file_name: string | null
          file_size: number | null
          id: string
          message_id: string
          mime_type: string | null
          organization_id: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          external_media_id?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          message_id: string
          mime_type?: string | null
          organization_id: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          external_media_id?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          message_id?: string
          mime_type?: string | null
          organization_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          metadata: Json
          organization_id: string
          sender_type: string
          status: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json
          organization_id: string
          sender_type: string
          status?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json
          organization_id?: string
          sender_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          organization_id: string
          product_id: string | null
          quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          organization_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          organization_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          contact_id: string | null
          created_at: string
          currency: string
          id: string
          lead_id: string | null
          organization_id: string
          paid_at: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          lead_id?: string | null
          organization_id: string
          paid_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          lead_id?: string | null
          organization_id?: string
          paid_at?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          ai_tone: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          onboarding_completed: boolean
          payment_methods: string[]
          policies: string | null
          segment: string | null
          updated_at: string
        }
        Insert: {
          ai_tone?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          onboarding_completed?: boolean
          payment_methods?: string[]
          policies?: string | null
          segment?: string | null
          updated_at?: string
        }
        Update: {
          ai_tone?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          onboarding_completed?: boolean
          payment_methods?: string[]
          policies?: string | null
          segment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          external_id: string | null
          id: string
          order_id: string
          organization_id: string
          provider: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          external_id?: string | null
          id?: string
          order_id: string
          organization_id: string
          provider?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          external_id?: string | null
          id?: string
          order_id?: string
          organization_id?: string
          provider?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          organization_id: string
          position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          benefits: string[]
          category_id: string | null
          checkout_url: string | null
          created_at: string
          description: string | null
          features: string[]
          id: string
          image_url: string | null
          name: string
          organization_id: string
          price: number
          promo_price: number | null
          status: string
          stock: number | null
          updated_at: string
        }
        Insert: {
          benefits?: string[]
          category_id?: string | null
          checkout_url?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          id?: string
          image_url?: string | null
          name: string
          organization_id: string
          price?: number
          promo_price?: number | null
          status?: string
          stock?: number | null
          updated_at?: string
        }
        Update: {
          benefits?: string[]
          category_id?: string | null
          checkout_url?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          id?: string
          image_url?: string | null
          name?: string
          organization_id?: string
          price?: number
          promo_price?: number | null
          status?: string
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_stage_history: {
        Row: {
          conversation_id: string
          created_at: string
          from_stage: string | null
          from_temperature: string | null
          id: string
          organization_id: string
          reason: string | null
          to_stage: string
          to_temperature: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          from_stage?: string | null
          from_temperature?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          to_stage: string
          to_temperature?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          from_stage?: string | null
          from_temperature?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          to_stage?: string
          to_temperature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_stage_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_stage_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error: string | null
          event_key: string
          event_type: string | null
          id: string
          organization_id: string | null
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
        }
        Insert: {
          error?: string | null
          event_key: string
          event_type?: string | null
          id?: string
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          event_key?: string
          event_type?: string | null
          id?: string
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          business_account_id: string | null
          connected_at: string | null
          created_at: string
          display_name: string | null
          id: string
          last_error: string | null
          organization_id: string
          phone_number: string | null
          phone_number_id: string | null
          provider: string
          status: string
          updated_at: string
          webhook_verified_at: string | null
        }
        Insert: {
          business_account_id?: string | null
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_error?: string | null
          organization_id: string
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          webhook_verified_at?: string | null
        }
        Update: {
          business_account_id?: string | null
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_error?: string | null
          organization_id?: string
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          webhook_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization: {
        Args: { _full_name?: string; _name: string }
        Returns: string
      }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string }; Returns: boolean }
    }
    Enums: {
      app_role: "OWNER" | "ADMIN" | "MANAGER" | "AGENT"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["OWNER", "ADMIN", "MANAGER", "AGENT"],
    },
  },
} as const
