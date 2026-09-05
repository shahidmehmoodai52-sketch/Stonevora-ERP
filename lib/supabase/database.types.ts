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
      account_templates: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          code?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          reason: string | null
          record_id: string
          table_name: string
          tenant_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
          tenant_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_of_materials: {
        Row: {
          bom_number: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string | null
          notes: string | null
          output_quantity: number
          output_uom_id: string
          product_id: string
          tenant_id: string
        }
        Insert: {
          bom_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          notes?: string | null
          output_quantity: number
          output_uom_id: string
          product_id: string
          tenant_id: string
        }
        Update: {
          bom_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          notes?: string | null
          output_quantity?: number
          output_uom_id?: string
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_output_uom_id_fkey"
            columns: ["output_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_of_materials_lines: {
        Row: {
          bom_id: string
          created_at: string
          id: string
          quantity: number
          raw_material_product_id: string
          tenant_id: string
          uom_id: string
        }
        Insert: {
          bom_id: string
          created_at?: string
          id?: string
          quantity: number
          raw_material_product_id: string
          tenant_id: string
          uom_id: string
        }
        Update: {
          bom_id?: string
          created_at?: string
          id?: string
          quantity?: number
          raw_material_product_id?: string
          tenant_id?: string
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_lines_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_lines_raw_material_product_id_fkey"
            columns: ["raw_material_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_lines_raw_material_product_id_fkey"
            columns: ["raw_material_product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          code: string
          country_code: string | null
          created_at: string
          id: string
          is_active: boolean
          is_head_office: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_head_office?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_head_office?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_capabilities: {
        Row: {
          code: string
          description: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          description: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          description?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      category_attribute_templates: {
        Row: {
          attribute_type_id: string
          category_id: string
          id: string
          is_required: boolean
          sort_order: number
          tenant_id: string
        }
        Insert: {
          attribute_type_id: string
          category_id: string
          id?: string
          is_required?: boolean
          sort_order?: number
          tenant_id: string
        }
        Update: {
          attribute_type_id?: string
          category_id?: string
          id?: string
          is_required?: boolean
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_attribute_templates_attribute_type_id_fkey"
            columns: ["attribute_type_id"]
            isOneToOne: false
            referencedRelation: "product_attribute_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_attribute_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_attribute_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          parent_account_id: string | null
          tenant_id: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          parent_account_id?: string | null
          tenant_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          parent_account_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          id: string
          iso_code2: string | null
          iso_code3: string | null
          name: string
        }
        Insert: {
          id?: string
          iso_code2?: string | null
          iso_code3?: string | null
          name: string
        }
        Update: {
          id?: string
          iso_code2?: string | null
          iso_code3?: string | null
          name?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          decimal_places: number
          id: string
          iso_code: string | null
          name: string
          symbol: string | null
        }
        Insert: {
          decimal_places?: number
          id?: string
          iso_code?: string | null
          name: string
          symbol?: string | null
        }
        Update: {
          decimal_places?: number
          id?: string
          iso_code?: string | null
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      customer_payments: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          method: string | null
          notes: string | null
          payment_date: string
          reference: string | null
          sales_invoice_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          reference?: string | null
          sales_invoice_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          reference?: string | null
          sales_invoice_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address: string | null
          code: string
          contact_name: string | null
          created_at: string
          credit_limit: number | null
          customer_type: Database["public"]["Enums"]["customer_type"]
          email: string | null
          id: string
          is_active: boolean
          name: string
          payment_terms_days: number
          phone: string | null
          price_list_id: string | null
          shipping_address: string | null
          tax_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          code: string
          contact_name?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          payment_terms_days?: number
          phone?: string | null
          price_list_id?: string | null
          shipping_address?: string | null
          tax_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          code?: string
          contact_name?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          payment_terms_days?: number
          phone?: string | null
          price_list_id?: string | null
          shipping_address?: string | null
          tax_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_price_list_fk"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          delivery_date: string
          delivery_number: string
          driver_name: string | null
          id: string
          notes: string | null
          sales_order_id: string
          status: Database["public"]["Enums"]["delivery_status"]
          tenant_id: string
          vehicle_info: string | null
          warehouse_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          delivery_number: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          sales_order_id: string
          status?: Database["public"]["Enums"]["delivery_status"]
          tenant_id: string
          vehicle_info?: string | null
          warehouse_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          delivery_number?: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          sales_order_id?: string
          status?: Database["public"]["Enums"]["delivery_status"]
          tenant_id?: string
          vehicle_info?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_lines: {
        Row: {
          base_quantity: number | null
          created_at: string
          delivery_id: string
          id: string
          product_id: string
          quantity: number
          sales_order_line_id: string
          tenant_id: string
          unit_cost: number | null
        }
        Insert: {
          base_quantity?: number | null
          created_at?: string
          delivery_id: string
          id?: string
          product_id: string
          quantity: number
          sales_order_line_id: string
          tenant_id: string
          unit_cost?: number | null
        }
        Update: {
          base_quantity?: number | null
          created_at?: string
          delivery_id?: string
          id?: string
          product_id?: string
          quantity?: number
          sales_order_line_id?: string
          tenant_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_lines_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_lines_sales_order_line_id_fkey"
            columns: ["sales_order_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_years: {
        Row: {
          end_date: string
          id: string
          is_closed: boolean
          name: string
          start_date: string
          tenant_id: string
        }
        Insert: {
          end_date: string
          id?: string
          is_closed?: boolean
          name: string
          start_date: string
          tenant_id: string
        }
        Update: {
          end_date?: string
          id?: string
          is_closed?: boolean
          name?: string
          start_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_years_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_lines: {
        Row: {
          allocated_landed_cost: number
          base_quantity: number | null
          batch_number: string | null
          caliber_code: string | null
          created_at: string
          dimension_height: number | null
          dimension_length: number | null
          dimension_uom_id: string | null
          dimension_width: number | null
          goods_receipt_id: string
          id: string
          location_id: string | null
          lot_number: string | null
          product_id: string
          purchase_order_line_id: string
          quantity: number
          quarry_source: string | null
          returned_quantity: number
          shade_code: string | null
          tenant_id: string
          total_unit_cost: number | null
          unit_code: string | null
          unit_cost: number
          unit_quality_grade: string | null
          unit_weight: number | null
          unit_weight_uom_id: string | null
          uom_id: string
          volume_uom_id: string | null
        }
        Insert: {
          allocated_landed_cost?: number
          base_quantity?: number | null
          batch_number?: string | null
          caliber_code?: string | null
          created_at?: string
          dimension_height?: number | null
          dimension_length?: number | null
          dimension_uom_id?: string | null
          dimension_width?: number | null
          goods_receipt_id: string
          id?: string
          location_id?: string | null
          lot_number?: string | null
          product_id: string
          purchase_order_line_id: string
          quantity: number
          quarry_source?: string | null
          returned_quantity?: number
          shade_code?: string | null
          tenant_id: string
          total_unit_cost?: number | null
          unit_code?: string | null
          unit_cost: number
          unit_quality_grade?: string | null
          unit_weight?: number | null
          unit_weight_uom_id?: string | null
          uom_id: string
          volume_uom_id?: string | null
        }
        Update: {
          allocated_landed_cost?: number
          base_quantity?: number | null
          batch_number?: string | null
          caliber_code?: string | null
          created_at?: string
          dimension_height?: number | null
          dimension_length?: number | null
          dimension_uom_id?: string | null
          dimension_width?: number | null
          goods_receipt_id?: string
          id?: string
          location_id?: string | null
          lot_number?: string | null
          product_id?: string
          purchase_order_line_id?: string
          quantity?: number
          quarry_source?: string | null
          returned_quantity?: number
          shade_code?: string | null
          tenant_id?: string
          total_unit_cost?: number | null
          unit_code?: string | null
          unit_cost?: number
          unit_quality_grade?: string | null
          unit_weight?: number | null
          unit_weight_uom_id?: string | null
          uom_id?: string
          volume_uom_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_lines_dimension_uom_id_fkey"
            columns: ["dimension_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_purchase_order_line_id_fkey"
            columns: ["purchase_order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_unit_weight_uom_id_fkey"
            columns: ["unit_weight_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_volume_uom_id_fkey"
            columns: ["volume_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          duty_cost: number
          freight_cost: number
          grn_number: string
          handling_cost: number
          id: string
          landed_cost_basis: Database["public"]["Enums"]["landed_cost_basis"]
          notes: string | null
          other_cost: number
          purchase_order_id: string
          receipt_date: string
          status: Database["public"]["Enums"]["goods_receipt_status"]
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          duty_cost?: number
          freight_cost?: number
          grn_number: string
          handling_cost?: number
          id?: string
          landed_cost_basis?: Database["public"]["Enums"]["landed_cost_basis"]
          notes?: string | null
          other_cost?: number
          purchase_order_id: string
          receipt_date?: string
          status?: Database["public"]["Enums"]["goods_receipt_status"]
          tenant_id: string
          warehouse_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          duty_cost?: number
          freight_cost?: number
          grn_number?: string
          handling_cost?: number
          id?: string
          landed_cost_basis?: Database["public"]["Enums"]["landed_cost_basis"]
          notes?: string | null
          other_cost?: number
          purchase_order_id?: string
          receipt_date?: string
          status?: Database["public"]["Enums"]["goods_receipt_status"]
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          batch_number: string
          caliber_code: string | null
          cost_per_uom: number
          created_at: string
          current_location_id: string | null
          expiry_date: string | null
          id: string
          lot_number: string | null
          manufactured_date: string | null
          output_production_batch_id: string | null
          product_id: string
          qty_on_hand: number
          reserved_qty: number
          shade_code: string | null
          status: Database["public"]["Enums"]["inventory_batch_status"]
          tenant_id: string
          uom_id: string | null
        }
        Insert: {
          batch_number: string
          caliber_code?: string | null
          cost_per_uom?: number
          created_at?: string
          current_location_id?: string | null
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          manufactured_date?: string | null
          output_production_batch_id?: string | null
          product_id: string
          qty_on_hand?: number
          reserved_qty?: number
          shade_code?: string | null
          status?: Database["public"]["Enums"]["inventory_batch_status"]
          tenant_id: string
          uom_id?: string | null
        }
        Update: {
          batch_number?: string
          caliber_code?: string | null
          cost_per_uom?: number
          created_at?: string
          current_location_id?: string | null
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          manufactured_date?: string | null
          output_production_batch_id?: string | null
          product_id?: string
          qty_on_hand?: number
          reserved_qty?: number
          shade_code?: string | null
          status?: Database["public"]["Enums"]["inventory_batch_status"]
          tenant_id?: string
          uom_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_output_production_batch_id_fkey"
            columns: ["output_production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          avg_cost: number
          id: string
          location_id: string | null
          product_id: string
          qty_on_hand: number
          reserved_qty: number
          tenant_id: string
          uom_id: string | null
          updated_at: string
        }
        Insert: {
          avg_cost?: number
          id?: string
          location_id?: string | null
          product_id: string
          qty_on_hand?: number
          reserved_qty?: number
          tenant_id: string
          uom_id?: string | null
          updated_at?: string
        }
        Update: {
          avg_cost?: number
          id?: string
          location_id?: string | null
          product_id?: string
          qty_on_hand?: number
          reserved_qty?: number
          tenant_id?: string
          uom_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_units: {
        Row: {
          actual_area: number | null
          actual_length: number | null
          actual_thickness: number | null
          actual_width: number | null
          area_uom_id: string | null
          consumed_by_project_id: string | null
          cost: number | null
          created_at: string
          current_location_id: string | null
          dimension_uom_id: string | null
          goods_receipt_line_id: string | null
          id: string
          output_processing_job_id: string | null
          parent_unit_id: string | null
          photo_url: string | null
          product_id: string
          qr_code_value: string | null
          quality_grade: string | null
          quarry_source: string | null
          selling_price: number | null
          sequence_number: number | null
          status: Database["public"]["Enums"]["inventory_unit_status"]
          supplier_id: string | null
          tenant_id: string
          unit_code: string
          unit_type: Database["public"]["Enums"]["inventory_unit_type"]
          usable_area: number | null
          volume: number | null
          volume_uom_id: string | null
          weight: number | null
          weight_uom_id: string | null
        }
        Insert: {
          actual_area?: number | null
          actual_length?: number | null
          actual_thickness?: number | null
          actual_width?: number | null
          area_uom_id?: string | null
          consumed_by_project_id?: string | null
          cost?: number | null
          created_at?: string
          current_location_id?: string | null
          dimension_uom_id?: string | null
          goods_receipt_line_id?: string | null
          id?: string
          output_processing_job_id?: string | null
          parent_unit_id?: string | null
          photo_url?: string | null
          product_id: string
          qr_code_value?: string | null
          quality_grade?: string | null
          quarry_source?: string | null
          selling_price?: number | null
          sequence_number?: number | null
          status?: Database["public"]["Enums"]["inventory_unit_status"]
          supplier_id?: string | null
          tenant_id: string
          unit_code: string
          unit_type?: Database["public"]["Enums"]["inventory_unit_type"]
          usable_area?: number | null
          volume?: number | null
          volume_uom_id?: string | null
          weight?: number | null
          weight_uom_id?: string | null
        }
        Update: {
          actual_area?: number | null
          actual_length?: number | null
          actual_thickness?: number | null
          actual_width?: number | null
          area_uom_id?: string | null
          consumed_by_project_id?: string | null
          cost?: number | null
          created_at?: string
          current_location_id?: string | null
          dimension_uom_id?: string | null
          goods_receipt_line_id?: string | null
          id?: string
          output_processing_job_id?: string | null
          parent_unit_id?: string | null
          photo_url?: string | null
          product_id?: string
          qr_code_value?: string | null
          quality_grade?: string | null
          quarry_source?: string | null
          selling_price?: number | null
          sequence_number?: number | null
          status?: Database["public"]["Enums"]["inventory_unit_status"]
          supplier_id?: string | null
          tenant_id?: string
          unit_code?: string
          unit_type?: Database["public"]["Enums"]["inventory_unit_type"]
          usable_area?: number | null
          volume?: number | null
          volume_uom_id?: string | null
          weight?: number | null
          weight_uom_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_units_area_uom_id_fkey"
            columns: ["area_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_consumed_by_project_id_fkey"
            columns: ["consumed_by_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_dimension_uom_id_fkey"
            columns: ["dimension_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_goods_receipt_line_id_fkey"
            columns: ["goods_receipt_line_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_output_processing_job_id_fkey"
            columns: ["output_processing_job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_parent_unit_id_fkey"
            columns: ["parent_unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_volume_uom_id_fkey"
            columns: ["volume_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_units_weight_uom_id_fkey"
            columns: ["weight_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          id: string
          reference_id: string | null
          reference_type: string
          reverses_entry_id: string | null
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          reference_id?: string | null
          reference_type: string
          reverses_entry_id?: string | null
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          reference_id?: string | null
          reference_type?: string
          reverses_entry_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
          tenant_id: string
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
          tenant_id: string
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          description: string | null
          id: string
          resource: string
        }
        Insert: {
          action: string
          description?: string | null
          id?: string
          resource: string
        }
        Update: {
          action?: string
          description?: string | null
          id?: string
          resource?: string
        }
        Relationships: []
      }
      price_list_items: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          price: number
          price_list_id: string
          product_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          price: number
          price_list_id: string
          product_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          price?: number
          price_list_id?: string
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          code: string
          created_at: string
          currency_id: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          currency_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          currency_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_lists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          actual_remnant_count: number | null
          actual_slab_count: number | null
          branch_id: string
          cancelled_at: string | null
          completed_at: string | null
          costs_recorded_at: string | null
          created_at: string
          created_by: string | null
          expected_slab_count: number | null
          id: string
          input_unit_id: string
          job_number: string
          machine: string | null
          notes: string | null
          operator_id: string | null
          overhead_cost: number | null
          processing_cost: number | null
          stage: Database["public"]["Enums"]["processing_stage"]
          started_at: string | null
          status: Database["public"]["Enums"]["processing_job_status"]
          tenant_id: string
          total_cost: number | null
          updated_at: string
          warehouse_id: string
          waste_volume: number | null
          waste_volume_uom_id: string | null
          yield_percentage: number | null
        }
        Insert: {
          actual_remnant_count?: number | null
          actual_slab_count?: number | null
          branch_id: string
          cancelled_at?: string | null
          completed_at?: string | null
          costs_recorded_at?: string | null
          created_at?: string
          created_by?: string | null
          expected_slab_count?: number | null
          id?: string
          input_unit_id: string
          job_number: string
          machine?: string | null
          notes?: string | null
          operator_id?: string | null
          overhead_cost?: number | null
          processing_cost?: number | null
          stage?: Database["public"]["Enums"]["processing_stage"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["processing_job_status"]
          tenant_id: string
          total_cost?: number | null
          updated_at?: string
          warehouse_id: string
          waste_volume?: number | null
          waste_volume_uom_id?: string | null
          yield_percentage?: number | null
        }
        Update: {
          actual_remnant_count?: number | null
          actual_slab_count?: number | null
          branch_id?: string
          cancelled_at?: string | null
          completed_at?: string | null
          costs_recorded_at?: string | null
          created_at?: string
          created_by?: string | null
          expected_slab_count?: number | null
          id?: string
          input_unit_id?: string
          job_number?: string
          machine?: string | null
          notes?: string | null
          operator_id?: string | null
          overhead_cost?: number | null
          processing_cost?: number | null
          stage?: Database["public"]["Enums"]["processing_stage"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["processing_job_status"]
          tenant_id?: string
          total_cost?: number | null
          updated_at?: string
          warehouse_id?: string
          waste_volume?: number | null
          waste_volume_uom_id?: string | null
          yield_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_input_unit_id_fkey"
            columns: ["input_unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_waste_volume_uom_id_fkey"
            columns: ["waste_volume_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_types: {
        Row: {
          code: string
          id: string
          name: string
        }
        Insert: {
          code: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          code: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          tenant_id: string
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          tenant_id: string
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_dimensions: {
        Row: {
          length_value: number | null
          product_id: string
          size_uom_id: string | null
          thickness_uom_id: string | null
          thickness_value: number | null
          weight_uom_id: string | null
          weight_value: number | null
          width_value: number | null
        }
        Insert: {
          length_value?: number | null
          product_id: string
          size_uom_id?: string | null
          thickness_uom_id?: string | null
          thickness_value?: number | null
          weight_uom_id?: string | null
          weight_value?: number | null
          width_value?: number | null
        }
        Update: {
          length_value?: number | null
          product_id?: string
          size_uom_id?: string | null
          thickness_uom_id?: string | null
          thickness_value?: number | null
          weight_uom_id?: string | null
          weight_value?: number | null
          width_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_dimensions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_dimensions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_dimensions_size_uom_id_fkey"
            columns: ["size_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_dimensions_thickness_uom_id_fkey"
            columns: ["thickness_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_dimensions_weight_uom_id_fkey"
            columns: ["weight_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lookup_values: {
        Row: {
          attribute_type_id: string
          code: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          attribute_type_id: string
          code: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          attribute_type_id?: string
          code?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_lookup_values_attribute_type_id_fkey"
            columns: ["attribute_type_id"]
            isOneToOne: false
            referencedRelation: "product_attribute_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lookup_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_numeric_attributes: {
        Row: {
          attribute_type_id: string
          id: string
          product_id: string
          tenant_id: string
          uom_id: string | null
          value: number
        }
        Insert: {
          attribute_type_id: string
          id?: string
          product_id: string
          tenant_id: string
          uom_id?: string | null
          value: number
        }
        Update: {
          attribute_type_id?: string
          id?: string
          product_id?: string
          tenant_id?: string
          uom_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_numeric_attributes_attribute_type_id_fkey"
            columns: ["attribute_type_id"]
            isOneToOne: false
            referencedRelation: "product_attribute_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_numeric_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_numeric_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_numeric_attributes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_numeric_attributes_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batch_consumptions: {
        Row: {
          created_at: string
          id: string
          production_batch_id: string
          quantity: number
          raw_material_product_id: string
          tenant_id: string
          unit_cost: number | null
          uom_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          production_batch_id: string
          quantity: number
          raw_material_product_id: string
          tenant_id: string
          unit_cost?: number | null
          uom_id: string
        }
        Update: {
          created_at?: string
          id?: string
          production_batch_id?: string
          quantity?: number
          raw_material_product_id?: string
          tenant_id?: string
          unit_cost?: number | null
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batch_consumptions_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_consumptions_raw_material_product_id_fkey"
            columns: ["raw_material_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_consumptions_raw_material_product_id_fkey"
            columns: ["raw_material_product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_consumptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_consumptions_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          actual_output_quantity: number | null
          batch_number: string
          bom_id: string
          branch_id: string
          caliber_code: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          kiln_number: string | null
          labor_cost: number | null
          notes: string | null
          overhead_cost: number | null
          planned_output_quantity: number
          raw_material_cost: number | null
          shade_code: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["production_batch_status"]
          tenant_id: string
          total_cost: number | null
          warehouse_id: string
        }
        Insert: {
          actual_output_quantity?: number | null
          batch_number: string
          bom_id: string
          branch_id: string
          caliber_code?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kiln_number?: string | null
          labor_cost?: number | null
          notes?: string | null
          overhead_cost?: number | null
          planned_output_quantity: number
          raw_material_cost?: number | null
          shade_code?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["production_batch_status"]
          tenant_id: string
          total_cost?: number | null
          warehouse_id: string
        }
        Update: {
          actual_output_quantity?: number | null
          batch_number?: string
          bom_id?: string
          branch_id?: string
          caliber_code?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kiln_number?: string | null
          labor_cost?: number | null
          notes?: string | null
          overhead_cost?: number | null
          planned_output_quantity?: number
          raw_material_cost?: number | null
          shade_code?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["production_batch_status"]
          tenant_id?: string
          total_cost?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          application_id: string | null
          barcode: string | null
          base_uom_id: string
          brand_id: string | null
          category_id: string | null
          collection_id: string | null
          color_id: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          finish_id: string | null
          grade_id: string | null
          id: string
          inventory_tracking_mode: Database["public"]["Enums"]["inventory_tracking_mode"]
          is_active: boolean
          material_type_id: string | null
          name: string
          origin_id: string | null
          pattern_id: string | null
          purchase_uom_id: string | null
          qr_code_value: string | null
          sales_uom_id: string | null
          sku: string
          standard_margin_pct: number | null
          surface_id: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          variety_id: string | null
        }
        Insert: {
          application_id?: string | null
          barcode?: string | null
          base_uom_id: string
          brand_id?: string | null
          category_id?: string | null
          collection_id?: string | null
          color_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          finish_id?: string | null
          grade_id?: string | null
          id?: string
          inventory_tracking_mode?: Database["public"]["Enums"]["inventory_tracking_mode"]
          is_active?: boolean
          material_type_id?: string | null
          name: string
          origin_id?: string | null
          pattern_id?: string | null
          purchase_uom_id?: string | null
          qr_code_value?: string | null
          sales_uom_id?: string | null
          sku: string
          standard_margin_pct?: number | null
          surface_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          variety_id?: string | null
        }
        Update: {
          application_id?: string | null
          barcode?: string | null
          base_uom_id?: string
          brand_id?: string | null
          category_id?: string | null
          collection_id?: string | null
          color_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          finish_id?: string | null
          grade_id?: string | null
          id?: string
          inventory_tracking_mode?: Database["public"]["Enums"]["inventory_tracking_mode"]
          is_active?: boolean
          material_type_id?: string | null
          name?: string
          origin_id?: string | null
          pattern_id?: string | null
          purchase_uom_id?: string | null
          qr_code_value?: string | null
          sales_uom_id?: string | null
          sku?: string
          standard_margin_pct?: number | null
          surface_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_base_uom_id_fkey"
            columns: ["base_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_material_type_id_fkey"
            columns: ["material_type_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sales_uom_id_fkey"
            columns: ["sales_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_surface_id_fkey"
            columns: ["surface_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      project_materials: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          inventory_unit_id: string
          project_id: string
          tenant_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          inventory_unit_id: string
          project_id: string
          tenant_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          inventory_unit_id?: string
          project_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_materials_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_inventory_unit_id_fkey"
            columns: ["inventory_unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          branch_id: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          labor_cost: number | null
          material_cost: number
          overhead_cost: number | null
          project_number: string
          status: Database["public"]["Enums"]["project_status"]
          tenant_id: string
          total_cost: number | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          branch_id: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          labor_cost?: number | null
          material_cost?: number
          overhead_cost?: number | null
          project_number: string
          status?: Database["public"]["Enums"]["project_status"]
          tenant_id: string
          total_cost?: number | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          labor_cost?: number | null
          material_cost?: number
          overhead_cost?: number | null
          project_number?: string
          status?: Database["public"]["Enums"]["project_status"]
          tenant_id?: string
          total_cost?: number | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          currency_id: string | null
          due_date: string | null
          goods_receipt_id: string | null
          id: string
          invoice_date: string
          invoice_number: string
          purchase_order_id: string | null
          status: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal: number
          supplier_id: string
          tax_amount: number
          tenant_id: string
          total_amount: number
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          due_date?: string | null
          goods_receipt_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal?: number
          supplier_id: string
          tax_amount?: number
          tenant_id: string
          total_amount?: number
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          due_date?: string | null
          goods_receipt_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal?: number
          supplier_id?: string
          tax_amount?: number
          tenant_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity: number
          tenant_id: string
          unit_price: number
          uom_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          tenant_id: string
          unit_price: number
          uom_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          tenant_id?: string
          unit_price?: number
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          currency_id: string | null
          exchange_rate: number
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          exchange_rate?: number
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          exchange_rate?: number
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_return_lines: {
        Row: {
          batch_id: string | null
          created_at: string
          goods_receipt_line_id: string
          id: string
          line_total: number
          location_id: string | null
          product_id: string
          purchase_return_id: string
          quantity: number
          tenant_id: string
          unit_cost: number
          uom_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          goods_receipt_line_id: string
          id?: string
          line_total: number
          location_id?: string | null
          product_id: string
          purchase_return_id: string
          quantity: number
          tenant_id: string
          unit_cost: number
          uom_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          goods_receipt_line_id?: string
          id?: string
          line_total?: number
          location_id?: string | null
          product_id?: string
          purchase_return_id?: string
          quantity?: number
          tenant_id?: string
          unit_cost?: number
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_lines_goods_receipt_line_id_fkey"
            columns: ["goods_receipt_line_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_lines_purchase_return_id_fkey"
            columns: ["purchase_return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          goods_receipt_id: string
          id: string
          posted_at: string | null
          reason: string | null
          return_date: string
          return_number: string
          status: Database["public"]["Enums"]["purchase_return_status"]
          subtotal: number
          supplier_id: string
          tenant_id: string
          total_amount: number
          warehouse_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          goods_receipt_id: string
          id?: string
          posted_at?: string | null
          reason?: string | null
          return_date?: string
          return_number: string
          status?: Database["public"]["Enums"]["purchase_return_status"]
          subtotal?: number
          supplier_id: string
          tenant_id: string
          total_amount?: number
          warehouse_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          goods_receipt_id?: string
          id?: string
          posted_at?: string | null
          reason?: string | null
          return_date?: string
          return_number?: string
          status?: Database["public"]["Enums"]["purchase_return_status"]
          subtotal?: number
          supplier_id?: string
          tenant_id?: string
          total_amount?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_inspections: {
        Row: {
          branch_id: string
          confirmed_grade: string | null
          defects: string | null
          id: string
          inspected_at: string
          inspected_by: string | null
          inventory_batch_id: string | null
          inventory_unit_id: string | null
          notes: string | null
          outcome: Database["public"]["Enums"]["qc_outcome"]
          tenant_id: string
        }
        Insert: {
          branch_id: string
          confirmed_grade?: string | null
          defects?: string | null
          id?: string
          inspected_at?: string
          inspected_by?: string | null
          inventory_batch_id?: string | null
          inventory_unit_id?: string | null
          notes?: string | null
          outcome: Database["public"]["Enums"]["qc_outcome"]
          tenant_id: string
        }
        Update: {
          branch_id?: string
          confirmed_grade?: string | null
          defects?: string | null
          id?: string
          inspected_at?: string
          inspected_by?: string | null
          inventory_batch_id?: string | null
          inventory_unit_id?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["qc_outcome"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_inspections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_inspections_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_inspections_inventory_batch_id_fkey"
            columns: ["inventory_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_inspections_inventory_unit_id_fkey"
            columns: ["inventory_unit_id"]
            isOneToOne: false
            referencedRelation: "inventory_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_inspections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
          tenant_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
          tenant_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_templates: {
        Row: {
          code: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          code: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          template_id: string | null
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          template_id?: string | null
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          template_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "role_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_lines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          line_total: number
          product_id: string
          quantity: number
          returned_quantity: number
          sales_invoice_id: string
          tenant_id: string
          unit_cost: number | null
          unit_price: number
          uom_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          line_total: number
          product_id: string
          quantity: number
          returned_quantity?: number
          sales_invoice_id: string
          tenant_id: string
          unit_cost?: number | null
          unit_price: number
          uom_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          returned_quantity?: number
          sales_invoice_id?: string
          tenant_id?: string
          unit_cost?: number | null
          unit_price?: number
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          amount_paid: number
          branch_id: string
          created_at: string
          created_by: string | null
          currency_id: string | null
          customer_id: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          sales_order_id: string | null
          status: Database["public"]["Enums"]["sales_invoice_status"]
          subtotal: number
          tax_amount: number
          tenant_id: string
          total_amount: number
        }
        Insert: {
          amount_paid?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          customer_id: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["sales_invoice_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total_amount?: number
        }
        Update: {
          amount_paid?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          customer_id?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["sales_invoice_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          base_quantity: number | null
          created_at: string
          delivered_quantity: number
          id: string
          product_id: string
          quantity: number
          reserved_quantity: number
          sales_order_id: string
          tenant_id: string
          unit_price: number
          uom_id: string
        }
        Insert: {
          base_quantity?: number | null
          created_at?: string
          delivered_quantity?: number
          id?: string
          product_id: string
          quantity: number
          reserved_quantity?: number
          sales_order_id: string
          tenant_id: string
          unit_price: number
          uom_id: string
        }
        Update: {
          base_quantity?: number | null
          created_at?: string
          delivered_quantity?: number
          id?: string
          product_id?: string
          quantity?: number
          reserved_quantity?: number
          sales_order_id?: string
          tenant_id?: string
          unit_price?: number
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          currency_id: string | null
          customer_id: string
          id: string
          notes: string | null
          order_date: string
          price_list_id: string | null
          so_number: string
          status: Database["public"]["Enums"]["sales_order_status"]
          tenant_id: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          order_date?: string
          price_list_id?: string | null
          so_number: string
          status?: Database["public"]["Enums"]["sales_order_status"]
          tenant_id: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          currency_id?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          order_date?: string
          price_list_id?: string | null
          so_number?: string
          status?: Database["public"]["Enums"]["sales_order_status"]
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return_lines: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string
          quantity: number
          restock: boolean
          restock_batch_id: string | null
          restock_location_id: string | null
          sales_invoice_line_id: string
          sales_return_id: string
          tenant_id: string
          unit_cost: number | null
          unit_price: number
          uom_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          product_id: string
          quantity: number
          restock?: boolean
          restock_batch_id?: string | null
          restock_location_id?: string | null
          sales_invoice_line_id: string
          sales_return_id: string
          tenant_id: string
          unit_cost?: number | null
          unit_price: number
          uom_id: string
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          restock?: boolean
          restock_batch_id?: string | null
          restock_location_id?: string | null
          sales_invoice_line_id?: string
          sales_return_id?: string
          tenant_id?: string
          unit_cost?: number | null
          unit_price?: number
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_restock_batch_id_fkey"
            columns: ["restock_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_restock_location_id_fkey"
            columns: ["restock_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_sales_invoice_line_id_fkey"
            columns: ["sales_invoice_line_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_sales_invoice_line_id_fkey"
            columns: ["sales_invoice_line_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_lines_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_sales_return_id_fkey"
            columns: ["sales_return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          posted_at: string | null
          reason: string | null
          return_date: string
          return_number: string
          sales_invoice_id: string
          status: Database["public"]["Enums"]["sales_return_status"]
          subtotal: number
          tenant_id: string
          total_amount: number
          warehouse_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          posted_at?: string | null
          reason?: string | null
          return_date?: string
          return_number: string
          sales_invoice_id: string
          status?: Database["public"]["Enums"]["sales_return_status"]
          subtotal?: number
          tenant_id: string
          total_amount?: number
          warehouse_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          posted_at?: string | null
          reason?: string | null
          return_date?: string
          return_number?: string
          sales_invoice_id?: string
          status?: Database["public"]["Enums"]["sales_return_status"]
          subtotal?: number
          tenant_id?: string
          total_amount?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_lines: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          location_id: string | null
          notes: string | null
          product_id: string
          quantity_change: number
          stock_adjustment_id: string
          tenant_id: string
          unit_cost: number | null
          uom_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          product_id: string
          quantity_change: number
          stock_adjustment_id: string
          tenant_id: string
          unit_cost?: number | null
          uom_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          product_id?: string
          quantity_change?: number
          stock_adjustment_id?: string
          tenant_id?: string
          unit_cost?: number | null
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_stock_adjustment_id_fkey"
            columns: ["stock_adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_number: string
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          posted_at: string | null
          reason_code: Database["public"]["Enums"]["stock_adjustment_reason"]
          status: Database["public"]["Enums"]["stock_adjustment_status"]
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_number: string
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          posted_at?: string | null
          reason_code: Database["public"]["Enums"]["stock_adjustment_reason"]
          status?: Database["public"]["Enums"]["stock_adjustment_status"]
          tenant_id: string
          warehouse_id: string
        }
        Update: {
          adjustment_date?: string
          adjustment_number?: string
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          posted_at?: string | null
          reason_code?: Database["public"]["Enums"]["stock_adjustment_reason"]
          status?: Database["public"]["Enums"]["stock_adjustment_status"]
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservation_lines: {
        Row: {
          base_quantity: number | null
          created_at: string
          id: string
          product_id: string
          quantity: number
          stock_reservation_id: string
          tenant_id: string
          unit_price: number
          uom_id: string
        }
        Insert: {
          base_quantity?: number | null
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          stock_reservation_id: string
          tenant_id: string
          unit_price: number
          uom_id: string
        }
        Update: {
          base_quantity?: number | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          stock_reservation_id?: string
          tenant_id?: string
          unit_price?: number
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservation_lines_stock_reservation_id_fkey"
            columns: ["stock_reservation_id"]
            isOneToOne: false
            referencedRelation: "stock_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservation_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservation_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          activated_at: string | null
          branch_id: string
          converted_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          expires_at: string | null
          id: string
          notes: string | null
          released_at: string | null
          reservation_number: string
          sales_order_id: string | null
          status: Database["public"]["Enums"]["stock_reservation_status"]
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          activated_at?: string | null
          branch_id: string
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          released_at?: string | null
          reservation_number: string
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["stock_reservation_status"]
          tenant_id: string
          warehouse_id: string
        }
        Update: {
          activated_at?: string | null
          branch_id?: string
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          released_at?: string | null
          reservation_number?: string
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["stock_reservation_status"]
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_lines: {
        Row: {
          base_quantity: number | null
          created_at: string
          destination_batch_id: string | null
          destination_location_id: string | null
          id: string
          product_id: string
          quantity: number
          received_quantity: number
          source_batch_id: string | null
          source_location_id: string | null
          stock_transfer_id: string
          tenant_id: string
          uom_id: string
        }
        Insert: {
          base_quantity?: number | null
          created_at?: string
          destination_batch_id?: string | null
          destination_location_id?: string | null
          id?: string
          product_id: string
          quantity: number
          received_quantity?: number
          source_batch_id?: string | null
          source_location_id?: string | null
          stock_transfer_id: string
          tenant_id: string
          uom_id: string
        }
        Update: {
          base_quantity?: number | null
          created_at?: string
          destination_batch_id?: string | null
          destination_location_id?: string | null
          id?: string
          product_id?: string
          quantity?: number
          received_quantity?: number
          source_batch_id?: string | null
          source_location_id?: string | null
          stock_transfer_id?: string
          tenant_id?: string
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_lines_destination_batch_id_fkey"
            columns: ["destination_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_stock_transfer_id_fkey"
            columns: ["stock_transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          destination_branch_id: string
          destination_warehouse_id: string
          id: string
          notes: string | null
          received_at: string | null
          requested_at: string | null
          shipped_at: string | null
          source_branch_id: string
          source_warehouse_id: string
          status: Database["public"]["Enums"]["stock_transfer_status"]
          tenant_id: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_branch_id: string
          destination_warehouse_id: string
          id?: string
          notes?: string | null
          received_at?: string | null
          requested_at?: string | null
          shipped_at?: string | null
          source_branch_id: string
          source_warehouse_id: string
          status?: Database["public"]["Enums"]["stock_transfer_status"]
          tenant_id: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_branch_id?: string
          destination_warehouse_id?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          requested_at?: string | null
          shipped_at?: string | null
          source_branch_id?: string
          source_warehouse_id?: string
          status?: Database["public"]["Enums"]["stock_transfer_status"]
          tenant_id?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_source_branch_id_fkey"
            columns: ["source_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktake_lines: {
        Row: {
          batch_id: string | null
          counted_at: string | null
          counted_by: string | null
          counted_quantity: number | null
          created_at: string
          id: string
          location_id: string | null
          product_id: string
          stocktake_id: string
          system_quantity: number | null
          tenant_id: string
          uom_id: string
        }
        Insert: {
          batch_id?: string | null
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string
          id?: string
          location_id?: string | null
          product_id: string
          stocktake_id: string
          system_quantity?: number | null
          tenant_id: string
          uom_id: string
        }
        Update: {
          batch_id?: string | null
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string
          id?: string
          location_id?: string | null
          product_id?: string
          stocktake_id?: string
          system_quantity?: number | null
          tenant_id?: string
          uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_lines_counted_by_fkey"
            columns: ["counted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_lines_stocktake_id_fkey"
            columns: ["stocktake_id"]
            isOneToOne: false
            referencedRelation: "stocktakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktakes: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          posted_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["stocktake_status"]
          stock_adjustment_id: string | null
          stocktake_number: string
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          posted_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["stocktake_status"]
          stock_adjustment_id?: string | null
          stocktake_number: string
          tenant_id: string
          warehouse_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          posted_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["stocktake_status"]
          stock_adjustment_id?: string | null
          stocktake_number?: string
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocktakes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktakes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktakes_stock_adjustment_id_fkey"
            columns: ["stock_adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktakes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktakes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_locations: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          location_type: Database["public"]["Enums"]["storage_location_type"]
          name: string | null
          parent_id: string | null
          path: string | null
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_type: Database["public"]["Enums"]["storage_location_type"]
          name?: string | null
          parent_id?: string | null
          path?: string | null
          tenant_id: string
          warehouse_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_type?: Database["public"]["Enums"]["storage_location_type"]
          name?: string | null
          parent_id?: string | null
          path?: string | null
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          notes: string | null
          payment_date: string
          purchase_invoice_id: string | null
          reference: string | null
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          purchase_invoice_id?: string | null
          reference?: string | null
          supplier_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          purchase_invoice_id?: string | null
          reference?: string | null
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          code: string
          contact_name: string | null
          country_code: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          payment_terms_days: number
          phone: string | null
          tax_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          payment_terms_days?: number
          phone?: string | null
          tax_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          payment_terms_days?: number
          phone?: string | null
          tax_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          name: string
          rate_percent: number
          tax_type_id: string
          tenant_id: string
        }
        Insert: {
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          name: string
          rate_percent: number
          tax_type_id: string
          tenant_id: string
        }
        Update: {
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rate_percent?: number
          tax_type_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_tax_type_id_fkey"
            columns: ["tax_type_id"]
            isOneToOne: false
            referencedRelation: "tax_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_types: {
        Row: {
          code: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          code: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_capabilities: {
        Row: {
          capability_id: string
          enabled_at: string
          enabled_by: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          capability_id: string
          enabled_at?: string
          enabled_by?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          capability_id?: string
          enabled_at?: string
          enabled_by?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_capabilities_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "business_capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_capabilities_enabled_by_fkey"
            columns: ["enabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_capabilities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          base_currency_id: string | null
          country_id: string | null
          created_at: string
          date_format: string
          fiscal_year_start_month: number
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          base_currency_id?: string | null
          country_id?: string | null
          created_at?: string
          date_format?: string
          fiscal_year_start_month?: number
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          base_currency_id?: string | null
          country_id?: string | null
          created_at?: string
          date_format?: string
          fiscal_year_start_month?: number
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_base_currency_id_fkey"
            columns: ["base_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_settings_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Relationships: []
      }
      uom: {
        Row: {
          category: Database["public"]["Enums"]["uom_category"]
          code: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["uom_category"]
          code: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["uom_category"]
          code?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uom_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      uom_conversions: {
        Row: {
          conversion_factor: number
          from_uom_id: string
          id: string
          is_active: boolean
          product_id: string | null
          tenant_id: string | null
          to_uom_id: string
        }
        Insert: {
          conversion_factor: number
          from_uom_id: string
          id?: string
          is_active?: boolean
          product_id?: string | null
          tenant_id?: string | null
          to_uom_id: string
        }
        Update: {
          conversion_factor?: number
          from_uom_id?: string
          id?: string
          is_active?: boolean
          product_id?: string | null
          tenant_id?: string | null
          to_uom_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uom_conversions_from_uom_id_fkey"
            columns: ["from_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uom_conversions_product_fk"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uom_conversions_product_fk"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uom_conversions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uom_conversions_to_uom_id_fkey"
            columns: ["to_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tenants: {
        Row: {
          created_at: string
          default_branch_id: string | null
          id: string
          invited_by: string | null
          is_active: boolean
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_branch_id?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_branch_id?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_default_branch_id_fkey"
            columns: ["default_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tenants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tenants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          branch_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          type: Database["public"]["Enums"]["warehouse_type"]
        }
        Insert: {
          branch_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          type?: Database["public"]["Enums"]["warehouse_type"]
        }
        Update: {
          branch_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["warehouse_type"]
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customer_ledger: {
        Row: {
          amount: number | null
          customer_id: string | null
          entry_date: string | null
          entry_type: string | null
          reference: string | null
          running_balance: number | null
          tenant_id: string | null
        }
        Relationships: []
      }
      products_secure: {
        Row: {
          application_id: string | null
          barcode: string | null
          base_uom_id: string | null
          brand_id: string | null
          category_id: string | null
          collection_id: string | null
          color_id: string | null
          cost_price: number | null
          created_at: string | null
          created_by: string | null
          finish_id: string | null
          grade_id: string | null
          id: string | null
          inventory_tracking_mode:
            | Database["public"]["Enums"]["inventory_tracking_mode"]
            | null
          is_active: boolean | null
          material_type_id: string | null
          name: string | null
          origin_id: string | null
          pattern_id: string | null
          purchase_uom_id: string | null
          qr_code_value: string | null
          sales_uom_id: string | null
          sku: string | null
          standard_margin_pct: number | null
          surface_id: string | null
          tenant_id: string | null
          updated_at: string | null
          updated_by: string | null
          variety_id: string | null
        }
        Insert: {
          application_id?: string | null
          barcode?: string | null
          base_uom_id?: string | null
          brand_id?: string | null
          category_id?: string | null
          collection_id?: string | null
          color_id?: string | null
          cost_price?: never
          created_at?: string | null
          created_by?: string | null
          finish_id?: string | null
          grade_id?: string | null
          id?: string | null
          inventory_tracking_mode?:
            | Database["public"]["Enums"]["inventory_tracking_mode"]
            | null
          is_active?: boolean | null
          material_type_id?: string | null
          name?: string | null
          origin_id?: string | null
          pattern_id?: string | null
          purchase_uom_id?: string | null
          qr_code_value?: string | null
          sales_uom_id?: string | null
          sku?: string | null
          standard_margin_pct?: never
          surface_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          variety_id?: string | null
        }
        Update: {
          application_id?: string | null
          barcode?: string | null
          base_uom_id?: string | null
          brand_id?: string | null
          category_id?: string | null
          collection_id?: string | null
          color_id?: string | null
          cost_price?: never
          created_at?: string | null
          created_by?: string | null
          finish_id?: string | null
          grade_id?: string | null
          id?: string | null
          inventory_tracking_mode?:
            | Database["public"]["Enums"]["inventory_tracking_mode"]
            | null
          is_active?: boolean | null
          material_type_id?: string | null
          name?: string | null
          origin_id?: string | null
          pattern_id?: string | null
          purchase_uom_id?: string | null
          qr_code_value?: string | null
          sales_uom_id?: string | null
          sku?: string | null
          standard_margin_pct?: never
          surface_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_base_uom_id_fkey"
            columns: ["base_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_finish_id_fkey"
            columns: ["finish_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_material_type_id_fkey"
            columns: ["material_type_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sales_uom_id_fkey"
            columns: ["sales_uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_surface_id_fkey"
            columns: ["surface_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "product_lookup_values"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_lines_secure: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          line_total: number | null
          margin: number | null
          product_id: string | null
          quantity: number | null
          sales_invoice_id: string | null
          tenant_id: string | null
          unit_cost: number | null
          unit_price: number | null
          uom_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          line_total?: number | null
          margin?: never
          product_id?: string | null
          quantity?: number | null
          sales_invoice_id?: string | null
          tenant_id?: string | null
          unit_cost?: never
          unit_price?: number | null
          uom_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          line_total?: number | null
          margin?: never
          product_id?: string | null
          quantity?: number | null
          sales_invoice_id?: string | null
          tenant_id?: string | null
          unit_cost?: never
          unit_price?: number | null
          uom_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return_lines_secure: {
        Row: {
          created_at: string | null
          id: string | null
          line_total: number | null
          margin: number | null
          product_id: string | null
          quantity: number | null
          restock: boolean | null
          sales_invoice_line_id: string | null
          sales_return_id: string | null
          tenant_id: string | null
          unit_cost: number | null
          unit_price: number | null
          uom_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          line_total?: number | null
          margin?: never
          product_id?: string | null
          quantity?: number | null
          restock?: boolean | null
          sales_invoice_line_id?: string | null
          sales_return_id?: string | null
          tenant_id?: string | null
          unit_cost?: never
          unit_price?: number | null
          uom_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          line_total?: number | null
          margin?: never
          product_id?: string | null
          quantity?: number | null
          restock?: boolean | null
          sales_invoice_line_id?: string | null
          sales_return_id?: string | null
          tenant_id?: string | null
          unit_cost?: never
          unit_price?: number | null
          uom_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_sales_invoice_line_id_fkey"
            columns: ["sales_invoice_line_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_sales_invoice_line_id_fkey"
            columns: ["sales_invoice_line_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_lines_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_sales_return_id_fkey"
            columns: ["sales_return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_ledger: {
        Row: {
          amount: number | null
          entry_date: string | null
          entry_type: string | null
          reference: string | null
          running_balance: number | null
          supplier_id: string | null
          tenant_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_stock_reservation: {
        Args: { p_hold_hours: number; p_stock_reservation_id: string }
        Returns: undefined
      }
      add_project_material: {
        Args: { p_inventory_unit_id: string; p_project_id: string }
        Returns: undefined
      }
      cancel_processing_job: {
        Args: { p_processing_job_id: string }
        Returns: undefined
      }
      cancel_production_batch: {
        Args: { p_production_batch_id: string }
        Returns: undefined
      }
      cancel_project: { Args: { p_project_id: string }; Returns: undefined }
      cancel_stock_transfer: {
        Args: { p_stock_transfer_id: string }
        Returns: undefined
      }
      cancel_stocktake: { Args: { p_stocktake_id: string }; Returns: undefined }
      complete_processing_job: {
        Args: { p_processing_job_id: string; p_slabs: Json }
        Returns: string[]
      }
      complete_production_batch: {
        Args: {
          p_actual_output_quantity: number
          p_caliber_code?: string
          p_labor_cost?: number
          p_output_location_id: string
          p_overhead_cost?: number
          p_production_batch_id: string
          p_shade_code?: string
        }
        Returns: string
      }
      complete_project: {
        Args: {
          p_labor_cost: number
          p_overhead_cost?: number
          p_project_id: string
        }
        Returns: undefined
      }
      confirm_sales_order: {
        Args: { p_sales_order_id: string }
        Returns: undefined
      }
      convert_reservation_to_sales_order: {
        Args: { p_so_number: string; p_stock_reservation_id: string }
        Returns: string
      }
      convert_uom_quantity: {
        Args: {
          p_from_uom_id: string
          p_product_id: string
          p_quantity: number
          p_tenant_id: string
          p_to_uom_id: string
        }
        Returns: number
      }
      create_tenant_for_user: {
        Args: { p_tenant_name: string; p_tenant_slug: string }
        Returns: string
      }
      dispatch_delivery: { Args: { p_delivery_id: string }; Returns: undefined }
      generate_ean13_code: {
        Args: { p_pool: string; p_tenant_id: string }
        Returns: string
      }
      generate_inventory_unit_qr_code: {
        Args: { p_inventory_unit_id: string }
        Returns: string
      }
      generate_product_barcode: {
        Args: { p_product_id: string }
        Returns: string
      }
      generate_project_invoice: {
        Args: {
          p_invoice_number: string
          p_material_prices: Json
          p_project_id: string
        }
        Returns: string
      }
      generate_sales_invoice_from_delivery: {
        Args: { p_delivery_id: string; p_invoice_number: string }
        Returns: string
      }
      get_balance_sheet: {
        Args: { p_as_of_date: string; p_branch_id: string; p_tenant_id: string }
        Returns: {
          account_id: string
          account_type: Database["public"]["Enums"]["account_type"]
          amount: number
          code: string
          name: string
        }[]
      }
      get_profit_and_loss: {
        Args: {
          p_branch_id: string
          p_end_date: string
          p_start_date: string
          p_tenant_id: string
        }
        Returns: {
          account_id: string
          account_type: Database["public"]["Enums"]["account_type"]
          amount: number
          code: string
          name: string
        }[]
      }
      has_branch_access: {
        Args: { check_branch_id: string; check_tenant_id: string }
        Returns: boolean
      }
      has_capability: {
        Args: { check_capability_code: string; check_tenant_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { check_tenant_id: string; p_action: string; p_resource: string }
        Returns: boolean
      }
      is_tenant_member: { Args: { check_tenant_id: string }; Returns: boolean }
      post_goods_receipt: {
        Args: { p_goods_receipt_id: string }
        Returns: undefined
      }
      post_journal_entry: {
        Args: {
          p_branch_id: string
          p_description: string
          p_entry_date: string
          p_lines: Json
          p_tenant_id: string
        }
        Returns: string
      }
      post_purchase_return: {
        Args: { p_purchase_return_id: string }
        Returns: undefined
      }
      post_sales_return: {
        Args: { p_sales_return_id: string }
        Returns: undefined
      }
      post_stock_adjustment: {
        Args: { p_stock_adjustment_id: string }
        Returns: undefined
      }
      post_stocktake: { Args: { p_stocktake_id: string }; Returns: string }
      receive_stock_transfer: {
        Args: { p_line_quantities?: Json; p_stock_transfer_id: string }
        Returns: undefined
      }
      record_batch_qc_inspection: {
        Args: {
          p_confirmed_grade?: string
          p_defects?: string
          p_inventory_batch_id: string
          p_notes?: string
          p_outcome: Database["public"]["Enums"]["qc_outcome"]
        }
        Returns: string
      }
      record_processing_costs: {
        Args: {
          p_overhead_cost?: number
          p_processing_cost: number
          p_processing_job_id: string
        }
        Returns: undefined
      }
      record_qc_inspection: {
        Args: {
          p_confirmed_grade?: string
          p_defects?: string
          p_inventory_unit_id: string
          p_notes?: string
          p_outcome: Database["public"]["Enums"]["qc_outcome"]
        }
        Returns: string
      }
      record_stocktake_count: {
        Args: { p_counted_quantity: number; p_stocktake_line_id: string }
        Returns: undefined
      }
      release_stock_reservation: {
        Args: { p_stock_reservation_id: string }
        Returns: undefined
      }
      remove_project_material: {
        Args: { p_inventory_unit_id: string; p_project_id: string }
        Returns: undefined
      }
      resolve_scanned_code: {
        Args: { p_code: string; p_tenant_id: string }
        Returns: {
          id: string
          label: string
          match_type: string
          secondary: string
        }[]
      }
      reverse_journal_entry: {
        Args: { p_journal_entry_id: string; p_reason: string }
        Returns: string
      }
      ship_stock_transfer: {
        Args: { p_stock_transfer_id: string }
        Returns: undefined
      }
      start_processing_job: {
        Args: { p_processing_job_id: string }
        Returns: undefined
      }
      start_production_batch: {
        Args: { p_production_batch_id: string }
        Returns: undefined
      }
      start_stocktake_count: {
        Args: { p_stocktake_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      customer_type:
        | "retail"
        | "dealer"
        | "contractor"
        | "project"
        | "corporate"
        | "international"
      delivery_status: "draft" | "dispatched" | "delivered"
      goods_receipt_status: "draft" | "posted"
      inventory_batch_status: "pending_qc" | "in_stock" | "rejected"
      inventory_tracking_mode: "simple" | "batch" | "unit"
      inventory_unit_status:
        | "in_stock"
        | "processing"
        | "consumed"
        | "pending_qc"
        | "rejected"
      inventory_unit_type: "block" | "slab" | "remnant"
      landed_cost_basis: "value" | "quantity"
      processing_job_status: "draft" | "in_progress" | "completed" | "cancelled"
      processing_stage: "cutting" | "squaring" | "polishing" | "other"
      production_batch_status:
        | "draft"
        | "in_progress"
        | "completed"
        | "cancelled"
      project_status: "draft" | "completed" | "cancelled"
      purchase_invoice_status: "draft" | "posted" | "partially_paid" | "paid"
      purchase_order_status:
        | "draft"
        | "confirmed"
        | "partially_received"
        | "received"
        | "cancelled"
      purchase_return_status: "draft" | "posted" | "cancelled"
      qc_outcome: "passed" | "rejected"
      sales_invoice_status:
        | "draft"
        | "posted"
        | "partially_paid"
        | "paid"
        | "cancelled"
      sales_order_status:
        | "draft"
        | "confirmed"
        | "partially_delivered"
        | "delivered"
        | "invoiced"
        | "cancelled"
      sales_return_status: "draft" | "posted" | "cancelled"
      stock_adjustment_reason:
        | "damage"
        | "shrinkage"
        | "theft"
        | "found"
        | "count_correction"
        | "other"
      stock_adjustment_status: "draft" | "posted" | "cancelled"
      stock_reservation_status: "draft" | "active" | "converted" | "released"
      stock_transfer_status:
        | "draft"
        | "requested"
        | "in_transit"
        | "received"
        | "cancelled"
      stocktake_status: "draft" | "counting" | "posted" | "cancelled"
      storage_location_type: "zone" | "row" | "rack" | "position"
      tenant_status: "trial" | "active" | "suspended" | "cancelled"
      uom_category: "count" | "length" | "area" | "volume" | "weight"
      warehouse_type: "warehouse" | "yard" | "showroom"
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
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      customer_type: [
        "retail",
        "dealer",
        "contractor",
        "project",
        "corporate",
        "international",
      ],
      delivery_status: ["draft", "dispatched", "delivered"],
      goods_receipt_status: ["draft", "posted"],
      inventory_batch_status: ["pending_qc", "in_stock", "rejected"],
      inventory_tracking_mode: ["simple", "batch", "unit"],
      inventory_unit_status: [
        "in_stock",
        "processing",
        "consumed",
        "pending_qc",
        "rejected",
      ],
      inventory_unit_type: ["block", "slab", "remnant"],
      landed_cost_basis: ["value", "quantity"],
      processing_job_status: ["draft", "in_progress", "completed", "cancelled"],
      processing_stage: ["cutting", "squaring", "polishing", "other"],
      production_batch_status: [
        "draft",
        "in_progress",
        "completed",
        "cancelled",
      ],
      project_status: ["draft", "completed", "cancelled"],
      purchase_invoice_status: ["draft", "posted", "partially_paid", "paid"],
      purchase_order_status: [
        "draft",
        "confirmed",
        "partially_received",
        "received",
        "cancelled",
      ],
      purchase_return_status: ["draft", "posted", "cancelled"],
      qc_outcome: ["passed", "rejected"],
      sales_invoice_status: [
        "draft",
        "posted",
        "partially_paid",
        "paid",
        "cancelled",
      ],
      sales_order_status: [
        "draft",
        "confirmed",
        "partially_delivered",
        "delivered",
        "invoiced",
        "cancelled",
      ],
      sales_return_status: ["draft", "posted", "cancelled"],
      stock_adjustment_reason: [
        "damage",
        "shrinkage",
        "theft",
        "found",
        "count_correction",
        "other",
      ],
      stock_adjustment_status: ["draft", "posted", "cancelled"],
      stock_reservation_status: ["draft", "active", "converted", "released"],
      stock_transfer_status: [
        "draft",
        "requested",
        "in_transit",
        "received",
        "cancelled",
      ],
      stocktake_status: ["draft", "counting", "posted", "cancelled"],
      storage_location_type: ["zone", "row", "rack", "position"],
      tenant_status: ["trial", "active", "suspended", "cancelled"],
      uom_category: ["count", "length", "area", "volume", "weight"],
      warehouse_type: ["warehouse", "yard", "showroom"],
    },
  },
} as const
