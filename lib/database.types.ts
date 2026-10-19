
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "active_timers": {
                  Row: {
                    "created_at": string,"last_active_at": string,"note": string | null,"paused_at": string | null,"paused_total": string,"started_at": string,"subject_id": string,"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"last_active_at": string,"note"?: string | null,"paused_at"?: string | null,"paused_total"?: string,"started_at": string,"subject_id": string,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"last_active_at"?: string,"note"?: string | null,"paused_at"?: string | null,"paused_total"?: string,"started_at"?: string,"subject_id"?: string,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "active_timers_subject_fk"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"updated_at": string,"user_id": string,"username": string,"username_changed_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"updated_at"?: string,"user_id": string,"username": string,"username_changed_at"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"updated_at"?: string,"user_id"?: string,"username"?: string,"username_changed_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"study_sessions": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"duration_minutes": number,"id": string,"note": string | null,"session_date": string,"session_time": string | null,"source": string,"subject_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"duration_minutes": number,"id"?: string,"note"?: string | null,"session_date": string,"session_time"?: string | null,"source"?: string,"subject_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"duration_minutes"?: number,"id"?: string,"note"?: string | null,"session_date"?: string,"session_time"?: string | null,"source"?: string,"subject_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_sessions_subject_fk"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"is_active": boolean,"last_used_at": string | null,"name_key": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id"?: string,"is_active"?: boolean,"last_used_at"?: string | null,"name_key"?: never,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"is_active"?: boolean,"last_used_at"?: string | null,"name_key"?: never,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_settings": {
                  Row: {
                    "created_at": string,"idle_prompt_minutes": number,"onboarded_at": string | null,"theme_mode": string,"time_format": string,"timezone": string,"updated_at": string,"user_id": string,"week_start": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"idle_prompt_minutes"?: number,"onboarded_at"?: string | null,"theme_mode"?: string,"time_format"?: string,"timezone"?: string,"updated_at"?: string,"user_id": string,"week_start"?: number
                  }
                  Update: {
                    "created_at"?: string,"idle_prompt_minutes"?: number,"onboarded_at"?: string | null,"theme_mode"?: string,"time_format"?: string,"timezone"?: string,"updated_at"?: string,"user_id"?: string,"week_start"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "visible_study_sessions": {
                  Row: {
                    "created_at": string | null,"deleted_at": string | null,"duration_minutes": number | null,"id": string | null,"note": string | null,"session_date": string | null,"session_time": string | null,"source": string | null,"subject_id": string | null,"updated_at": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "created_at"?: string | null,"deleted_at"?: string | null,"duration_minutes"?: number | null,"id"?: string | null,"note"?: string | null,"session_date"?: string | null,"session_time"?: string | null,"source"?: string | null,"subject_id"?: string | null,"updated_at"?: string | null,"user_id"?: string | null
                         }
                        Update: {
                           "created_at"?: string | null,"deleted_at"?: string | null,"duration_minutes"?: number | null,"id"?: string | null,"note"?: string | null,"session_date"?: string | null,"session_time"?: string | null,"source"?: string | null,"subject_id"?: string | null,"updated_at"?: string | null,"user_id"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "study_sessions_subject_fk"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Functions: {
            "add_subject":
{ Args: { "p_name": string }; Returns: {
              "created_at": string,
"display_name": string,
"id": string,
"is_active": boolean,
"last_used_at": string | null,
"name_key": string | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "subjects"
        isOneToOne: true
        isSetofReturn: false
      } },
"timer_discard":
{ Args: { "p_version": number }; Returns: Json
                           },
"timer_get":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"timer_heartbeat":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"timer_pause":
{ Args: { "p_version": number }; Returns: Json
                           },
"timer_resume":
{ Args: { "p_version": number }; Returns: Json
                           },
"timer_save":
{ Args: { "p_duration_minutes"?: number,"p_end"?: string,"p_version": number }; Returns: Json
                           },
"timer_start":
{ Args: { "p_note"?: string,"p_subject_id": string }; Returns: Json
                           },
"timer_update_details":
{ Args: { "p_note": string,"p_subject_id": string,"p_version": number }; Returns: Json
                           },
"username_available":
{ Args: { "p_username": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
