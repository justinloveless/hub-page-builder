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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          id: number
          metadata: Json
          site_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          metadata?: Json
          site_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          metadata?: Json
          site_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_shares: {
        Row: {
          allowed_extensions: string[] | null
          asset_path: string
          created_at: string
          created_by: string
          description: string | null
          expires_at: string
          id: string
          max_uploads: number | null
          site_id: string
          token: string
          updated_at: string
          upload_count: number
        }
        Insert: {
          allowed_extensions?: string[] | null
          asset_path: string
          created_at?: string
          created_by: string
          description?: string | null
          expires_at: string
          id?: string
          max_uploads?: number | null
          site_id: string
          token: string
          updated_at?: string
          upload_count?: number
        }
        Update: {
          allowed_extensions?: string[] | null
          asset_path?: string
          created_at?: string
          created_by?: string
          description?: string | null
          expires_at?: string
          id?: string
          max_uploads?: number | null
          site_id?: string
          token?: string
          updated_at?: string
          upload_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_shares_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_versions: {
        Row: {
          batch_id: string | null
          checksum: string | null
          created_at: string
          created_by: string
          file_size_bytes: number
          id: string
          repo_path: string
          site_id: string
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          checksum?: string | null
          created_at?: string
          created_by: string
          file_size_bytes: number
          id?: string
          repo_path: string
          site_id: string
          status: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string
          file_size_bytes?: number
          id?: string
          repo_path?: string
          site_id?: string
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_versions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "change_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_versions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      change_batches: {
        Row: {
          commit_message: string | null
          commit_sha: string | null
          created_at: string
          creator_user_id: string
          id: string
          metadata: Json
          site_id: string
          state: string
          updated_at: string
        }
        Insert: {
          commit_message?: string | null
          commit_sha?: string | null
          created_at?: string
          creator_user_id: string
          id?: string
          metadata?: Json
          site_id: string
          state?: string
          updated_at?: string
        }
        Update: {
          commit_message?: string | null
          commit_sha?: string | null
          created_at?: string
          creator_user_id?: string
          id?: string
          metadata?: Json
          site_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_batches_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      github_app_config: {
        Row: {
          client_secret: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          client_secret: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          client_secret?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      github_app_public_config: {
        Row: {
          app_id: string | null
          client_id: string
          created_at: string
          id: string
          slug: string
          updated_at: string
        }
        Insert: {
          app_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          slug: string
          updated_at?: string
        }
        Update: {
          app_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invite_code: string | null
          inviter_user_id: string
          role: string
          site_id: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          invite_code?: string | null
          inviter_user_id: string
          role?: string
          site_id: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string | null
          inviter_user_id?: string
          role?: string
          site_id?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      site_members: {
        Row: {
          created_at: string
          role: string
          site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_members_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          created_by: string
          default_branch: string
          github_app_slug: string | null
          github_installation_id: number
          id: string
          name: string
          repo_full_name: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_branch: string
          github_app_slug?: string | null
          github_installation_id: number
          id?: string
          name: string
          repo_full_name: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_branch?: string
          github_app_slug?: string | null
          github_installation_id?: number
          id?: string
          name?: string
          repo_full_name?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          id: string
          flag_key: string
          name: string
          description: string | null
          enabled: boolean
          rollout_percentage: number
          user_targeting: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          flag_key: string
          name: string
          description?: string | null
          enabled?: boolean
          rollout_percentage?: number
          user_targeting?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          flag_key?: string
          name?: string
          description?: string | null
          enabled?: boolean
          rollout_percentage?: number
          user_targeting?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          preview_image_url: string | null
          repo_full_name: string
          submitted_by: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          name: string
          preview_image_url?: string | null
          repo_full_name: string
          submitted_by: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          preview_image_url?: string | null
          repo_full_name?: string
          submitted_by?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_site_member: { Args: { target_site_id: string }; Returns: boolean }
      is_site_member_from_path: {
        Args: { object_name: string }
        Returns: boolean
      }
      is_site_owner: { Args: { target_site_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
