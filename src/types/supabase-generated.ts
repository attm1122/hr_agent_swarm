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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent_type: string
          confidence: number | null
          context: Json | null
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          input_payload: Json
          intent: string
          output_result: Json | null
          success: boolean
          tenant_id: string
        }
        Insert: {
          agent_type: string
          confidence?: number | null
          context?: Json | null
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_payload: Json
          intent: string
          output_result?: Json | null
          success?: boolean
          tenant_id: string
        }
        Update: {
          agent_type?: string
          confidence?: number | null
          context?: Json | null
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_payload?: Json
          intent?: string
          output_result?: Json | null
          success?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          acted_at: string | null
          approver_id: string
          approver_role: string
          comments: string | null
          created_at: string | null
          due_date: string
          escalated_at: string | null
          escalated_to: string | null
          id: string
          status: string
          step_number: number
          tenant_id: string
          updated_at: string | null
          workflow_id: string
        }
        Insert: {
          acted_at?: string | null
          approver_id: string
          approver_role: string
          comments?: string | null
          created_at?: string | null
          due_date: string
          escalated_at?: string | null
          escalated_to?: string | null
          id?: string
          status?: string
          step_number: number
          tenant_id: string
          updated_at?: string | null
          workflow_id: string
        }
        Update: {
          acted_at?: string | null
          approver_id?: string
          approver_role?: string
          comments?: string | null
          created_at?: string | null
          due_date?: string
          escalated_at?: string | null
          escalated_to?: string | null
          id?: string
          status?: string
          step_number?: number
          tenant_id?: string
          updated_at?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_steps_escalated_to_fkey"
            columns: ["escalated_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          new_state: Json | null
          previous_state: Json | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_state?: Json | null
          previous_state?: Json | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_state?: Json | null
          previous_state?: Json | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string | null
          agent_type: string | null
          approval_status: string | null
          created_at: string | null
          error_message: string | null
          event_id: string
          event_type: string
          fields_accessed: string[] | null
          id: string
          integrity_hash: string
          intent: string | null
          ip_address: string | null
          previous_hash: string | null
          requires_approval: boolean | null
          resource_id: string | null
          resource_type: string | null
          risk_score: number | null
          role: string
          sensitivity_level: string | null
          session_id: string
          success: boolean
          tenant_id: string
          timestamp: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action?: string | null
          agent_type?: string | null
          approval_status?: string | null
          created_at?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          fields_accessed?: string[] | null
          id?: string
          integrity_hash: string
          intent?: string | null
          ip_address?: string | null
          previous_hash?: string | null
          requires_approval?: boolean | null
          resource_id?: string | null
          resource_type?: string | null
          risk_score?: number | null
          role: string
          sensitivity_level?: string | null
          session_id: string
          success?: boolean
          tenant_id: string
          timestamp?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string | null
          agent_type?: string | null
          approval_status?: string | null
          created_at?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          fields_accessed?: string[] | null
          id?: string
          integrity_hash?: string
          intent?: string | null
          ip_address?: string | null
          previous_hash?: string | null
          requires_approval?: boolean | null
          resource_id?: string | null
          resource_type?: string | null
          risk_score?: number | null
          role?: string
          sensitivity_level?: string | null
          session_id?: string
          success?: boolean
          tenant_id?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compensation_records: {
        Row: {
          base_salary: number
          bonus_amount: number | null
          bonus_type: string | null
          created_at: string | null
          currency: string
          effective_date: string
          employee_id: string
          hr3_sync_id: string | null
          hr3_synced_at: string | null
          id: string
          salary_frequency: string
          tenant_id: string
          total_compensation: number
          updated_at: string | null
        }
        Insert: {
          base_salary: number
          bonus_amount?: number | null
          bonus_type?: string | null
          created_at?: string | null
          currency?: string
          effective_date: string
          employee_id: string
          hr3_sync_id?: string | null
          hr3_synced_at?: string | null
          id?: string
          salary_frequency?: string
          tenant_id: string
          total_compensation: number
          updated_at?: string | null
        }
        Update: {
          base_salary?: number
          bonus_amount?: number | null
          bonus_type?: string | null
          created_at?: string | null
          currency?: string
          effective_date?: string
          employee_id?: string
          hr3_sync_id?: string | null
          hr3_synced_at?: string | null
          id?: string
          salary_frequency?: string
          tenant_id?: string
          total_compensation?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compensation_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compensation_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requirements: {
        Row: {
          category: string
          created_at: string | null
          employment_types: string[]
          expiration_warning_days: number | null
          expires: boolean
          id: string
          required: boolean
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          employment_types?: string[]
          expiration_warning_days?: number | null
          expires?: boolean
          id?: string
          required?: boolean
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          employment_types?: string[]
          expiration_warning_days?: number | null
          expires?: boolean
          id?: string
          required?: boolean
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          category: string
          created_at: string | null
          employee_id: string
          expires_at: string | null
          extracted_data: Json | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          onedrive_id: string
          onedrive_path: string
          status: string
          tenant_id: string
          updated_at: string | null
          uploaded_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          employee_id: string
          expires_at?: string | null
          extracted_data?: Json | null
          file_name: string
          file_size: number
          file_type: string
          id?: string
          onedrive_id: string
          onedrive_path: string
          status?: string
          tenant_id: string
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          employee_id?: string
          expires_at?: string | null
          extracted_data?: Json | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          onedrive_id?: string
          onedrive_path?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_provider_id: string | null
          created_at: string | null
          email: string
          employee_number: string
          employment_type: string
          first_name: string
          hire_date: string
          id: string
          last_name: string
          manager_id: string | null
          position_id: string | null
          status: string
          team_id: string | null
          tenant_id: string
          termination_date: string | null
          updated_at: string | null
          work_location: string | null
        }
        Insert: {
          auth_provider_id?: string | null
          created_at?: string | null
          email: string
          employee_number: string
          employment_type?: string
          first_name: string
          hire_date: string
          id?: string
          last_name: string
          manager_id?: string | null
          position_id?: string | null
          status?: string
          team_id?: string | null
          tenant_id: string
          termination_date?: string | null
          updated_at?: string | null
          work_location?: string | null
        }
        Update: {
          auth_provider_id?: string | null
          created_at?: string | null
          email?: string
          employee_number?: string
          employment_type?: string
          first_name?: string
          hire_date?: string
          id?: string
          last_name?: string
          manager_id?: string | null
          position_id?: string | null
          status?: string
          team_id?: string | null
          tenant_id?: string
          termination_date?: string | null
          updated_at?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          created_at: string | null
          employee_id: string
          entitlement_days: number
          id: string
          leave_type: string
          pending_days: number
          period_end: string
          period_start: string
          remaining_days: number
          taken_days: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          entitlement_days?: number
          id?: string
          leave_type: string
          pending_days?: number
          period_end: string
          period_start: string
          remaining_days?: number
          taken_days?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          entitlement_days?: number
          id?: string
          leave_type?: string
          pending_days?: number
          period_end?: string
          period_start?: string
          remaining_days?: number
          taken_days?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          days_requested: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days_requested: number
          employee_id: string
          end_date: string
          id?: string
          leave_type: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days_requested?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_days_before: number
          created_at: string | null
          description: string
          employee_id: string
          id: string
          milestone_date: string
          milestone_type: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_days_before?: number
          created_at?: string | null
          description: string
          employee_id: string
          id?: string
          milestone_date: string
          milestone_type: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_days_before?: number
          created_at?: string | null
          description?: string
          employee_id?: string
          id?: string
          milestone_date?: string
          milestone_type?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      offboarding_plans: {
        Row: {
          actual_completion_date: string | null
          checklist_template: string
          created_at: string | null
          employee_id: string
          id: string
          initiated_by: string
          status: string
          target_completion_date: string
          tenant_id: string
          termination_date: string
          updated_at: string | null
        }
        Insert: {
          actual_completion_date?: string | null
          checklist_template: string
          created_at?: string | null
          employee_id: string
          id?: string
          initiated_by: string
          status?: string
          target_completion_date: string
          tenant_id: string
          termination_date: string
          updated_at?: string | null
        }
        Update: {
          actual_completion_date?: string | null
          checklist_template?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          initiated_by?: string
          status?: string
          target_completion_date?: string
          tenant_id?: string
          termination_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offboarding_plans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_plans_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      offboarding_tasks: {
        Row: {
          assigned_to: string
          category: string
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          depends_on: string[] | null
          due_date: string
          id: string
          plan_id: string
          priority: string
          status: string
          task_name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_to: string
          category: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          depends_on?: string[] | null
          due_date: string
          id?: string
          plan_id: string
          priority?: string
          status?: string
          task_name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          depends_on?: string[] | null
          due_date?: string
          id?: string
          plan_id?: string
          priority?: string
          status?: string
          task_name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offboarding_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "offboarding_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_plans: {
        Row: {
          actual_completion_date: string | null
          created_at: string | null
          employee_id: string
          id: string
          start_date: string
          status: string
          target_completion_date: string
          template_name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          actual_completion_date?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          start_date: string
          status?: string
          target_completion_date: string
          template_name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          actual_completion_date?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          start_date?: string
          status?: string
          target_completion_date?: string
          template_name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_plans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          assigned_to: string
          category: string
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          depends_on: string[] | null
          description: string | null
          due_date: string
          id: string
          plan_id: string
          priority: string
          status: string
          task_name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_to: string
          category: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          depends_on?: string[] | null
          description?: string | null
          due_date: string
          id?: string
          plan_id: string
          priority?: string
          status?: string
          task_name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          depends_on?: string[] | null
          description?: string | null
          due_date?: string
          id?: string
          plan_id?: string
          priority?: string
          status?: string
          task_name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "onboarding_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policy_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "policy_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_chunks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_documents: {
        Row: {
          category: string
          content_hash: string
          created_at: string | null
          effective_date: string
          id: string
          source_url: string | null
          tenant_id: string
          title: string
          updated_at: string | null
          version: string
        }
        Insert: {
          category: string
          content_hash: string
          created_at?: string | null
          effective_date: string
          id?: string
          source_url?: string | null
          tenant_id: string
          title: string
          updated_at?: string | null
          version: string
        }
        Update: {
          category?: string
          content_hash?: string
          created_at?: string | null
          effective_date?: string
          id?: string
          source_url?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          created_at: string | null
          department: string
          id: string
          job_family: string
          level: string
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department: string
          id?: string
          job_family: string
          level: string
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string
          id?: string
          job_family?: string
          level?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      report_definitions: {
        Row: {
          category: string
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          parameters: Json | null
          query_config: Json
          requires_approval: boolean
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          parameters?: Json | null
          query_config: Json
          requires_approval?: boolean
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          parameters?: Json | null
          query_config?: Json
          requires_approval?: boolean
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          created_at: string | null
          error_message: string | null
          generated_at: string | null
          generated_by: string
          id: string
          parameters: Json | null
          report_definition_id: string
          result_data: Json | null
          row_count: number | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          generated_at?: string | null
          generated_by: string
          id?: string
          parameters?: Json | null
          report_definition_id: string
          result_data?: Json | null
          row_count?: number | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          generated_at?: string | null
          generated_by?: string
          id?: string
          parameters?: Json | null
          report_definition_id?: string
          result_data?: Json | null
          row_count?: number | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_report_definition_id_fkey"
            columns: ["report_definition_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          code: string
          cost_center: string | null
          created_at: string | null
          department: string
          id: string
          name: string
          parent_team_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          code: string
          cost_center?: string | null
          created_at?: string | null
          department: string
          id?: string
          name: string
          parent_team_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          cost_center?: string | null
          created_at?: string | null
          department?: string
          id?: string
          name?: string
          parent_team_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      workflows: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step: number
          id: string
          initiator_id: string
          reference_id: string
          reference_type: string
          started_at: string | null
          status: string
          tenant_id: string
          total_steps: number
          updated_at: string | null
          workflow_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number
          id?: string
          initiator_id: string
          reference_id: string
          reference_type: string
          started_at?: string | null
          status?: string
          tenant_id: string
          total_steps: number
          updated_at?: string | null
          workflow_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number
          id?: string
          initiator_id?: string
          reference_id?: string
          reference_type?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          total_steps?: number
          updated_at?: string | null
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      current_user_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_manager_of: { Args: { employee_uuid: string }; Returns: boolean }
      is_same_team: { Args: { employee_uuid: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
