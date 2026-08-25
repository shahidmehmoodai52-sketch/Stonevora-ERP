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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
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
      inventory_batches: {
        Row: {
          batch_number: string
          caliber_code: string | null
          created_at: string
          current_location_id: string | null
          expiry_date: string | null
          id: string
          lot_number: string | null
          manufactured_date: string | null
          product_id: string
          qty_on_hand: number
          shade_code: string | null
          tenant_id: string
          uom_id: string | null
        }
        Insert: {
          batch_number: string
          caliber_code?: string | null
          created_at?: string
          current_location_id?: string | null
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          manufactured_date?: string | null
          product_id: string
          qty_on_hand?: number
          shade_code?: string | null
          tenant_id: string
          uom_id?: string | null
        }
        Update: {
          batch_number?: string
          caliber_code?: string | null
          created_at?: string
          current_location_id?: string | null
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          manufactured_date?: string | null
          product_id?: string
          qty_on_hand?: number
          shade_code?: string | null
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
          id: string
          location_id: string | null
          product_id: string
          qty_on_hand: number
          tenant_id: string
          uom_id: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          location_id?: string | null
          product_id: string
          qty_on_hand?: number
          tenant_id: string
          uom_id?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string | null
          product_id?: string
          qty_on_hand?: number
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
          cost: number | null
          created_at: string
          current_location_id: string | null
          id: string
          parent_unit_id: string | null
          photo_url: string | null
          product_id: string
          qr_code_value: string | null
          quality_grade: string | null
          selling_price: number | null
          sequence_number: number | null
          status: string
          tenant_id: string
          unit_code: string
          unit_type: Database["public"]["Enums"]["inventory_unit_type"]
        }
        Insert: {
          actual_area?: number | null
          actual_length?: number | null
          actual_thickness?: number | null
          actual_width?: number | null
          cost?: number | null
          created_at?: string
          current_location_id?: string | null
          id?: string
          parent_unit_id?: string | null
          photo_url?: string | null
          product_id: string
          qr_code_value?: string | null
          quality_grade?: string | null
          selling_price?: number | null
          sequence_number?: number | null
          status?: string
          tenant_id: string
          unit_code: string
          unit_type?: Database["public"]["Enums"]["inventory_unit_type"]
        }
        Update: {
          actual_area?: number | null
          actual_length?: number | null
          actual_thickness?: number | null
          actual_width?: number | null
          cost?: number | null
          created_at?: string
          current_location_id?: string | null
          id?: string
          parent_unit_id?: string | null
          photo_url?: string | null
          product_id?: string
          qr_code_value?: string | null
          quality_grade?: string | null
          selling_price?: number | null
          sequence_number?: number | null
          status?: string
          tenant_id?: string
          unit_code?: string
          unit_type?: Database["public"]["Enums"]["inventory_unit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_units_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
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
            foreignKeyName: "inventory_units_tenant_id_fkey"
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
    }
    Functions: {
      create_tenant_for_user: {
        Args: { p_tenant_name: string; p_tenant_slug: string }
        Returns: string
      }
      has_permission: {
        Args: { check_tenant_id: string; p_action: string; p_resource: string }
        Returns: boolean
      }
      is_tenant_member: { Args: { check_tenant_id: string }; Returns: boolean }
    }
    Enums: {
      inventory_tracking_mode: "simple" | "batch" | "unit"
      inventory_unit_type: "block" | "slab" | "remnant"
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
      inventory_tracking_mode: ["simple", "batch", "unit"],
      inventory_unit_type: ["block", "slab", "remnant"],
      storage_location_type: ["zone", "row", "rack", "position"],
      tenant_status: ["trial", "active", "suspended", "cancelled"],
      uom_category: ["count", "length", "area", "volume", "weight"],
      warehouse_type: ["warehouse", "yard", "showroom"],
    },
  },
} as const
