export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          role: 'customer' | 'store_owner';
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone: string;
          role: 'customer' | 'store_owner';
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          role?: 'customer' | 'store_owner';
          created_at?: string;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          address: string;
          lat: number;
          lng: number;
          is_open: boolean;
          offers_delivery: boolean;
          serviceable_pincodes: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          address: string;
          lat: number;
          lng: number;
          is_open?: boolean;
          offers_delivery?: boolean;
          serviceable_pincodes?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          address?: string;
          lat?: number;
          lng?: number;
          is_open?: boolean;
          offers_delivery?: boolean;
          serviceable_pincodes?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      medicines: {
        Row: {
          id: string;
          name: string;
          generic_name: string;
          strength: string;
          form: string;
          requires_prescription: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          generic_name: string;
          strength: string;
          form: string;
          requires_prescription?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          generic_name?: string;
          strength?: string;
          form?: string;
          requires_prescription?: boolean;
        };
        Relationships: [];
      };
      store_inventory: {
        Row: {
          store_id: string;
          medicine_id: string;
          price: number;
          stock: number;
        };
        Insert: {
          store_id: string;
          medicine_id: string;
          price: number;
          stock?: number;
        };
        Update: {
          store_id?: string;
          medicine_id?: string;
          price?: number;
          stock?: number;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          customer_id: string;
          store_id: string;
          fulfilment_type: 'pickup' | 'delivery';
          status: OrderStatus;
          delivery_address: string | null;
          delivery_pincode: string | null;
          prescription_path: string | null;
          reject_reason: string | null;
          handover_code: string;
          total: number;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          store_id: string;
          fulfilment_type: 'pickup' | 'delivery';
          status?: string;
          delivery_address?: string | null;
          delivery_pincode?: string | null;
          prescription_path?: string | null;
          reject_reason?: string | null;
          handover_code: string;
          total: number;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          status?: string;
          reject_reason?: string | null;
          prescription_path?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          medicine_id: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          medicine_id: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          quantity?: number;
          unit_price?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          message: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_id: string;
          message: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      nearby_stores: {
        Args: {
          user_lat: number;
          user_lng: number;
          radius_km?: number;
          medicine_ids?: string[];
        };
        Returns: {
          store_id: string;
          store_name: string;
          address: string;
          lat: number;
          lng: number;
          is_open: boolean;
          offers_delivery: boolean;
          distance_km: number;
          total_price: number;
          missing_medicines: string[];
        }[];
      };
      stores_for_pincode: {
        Args: {
          p_pincode: string;
          medicine_ids?: string[];
        };
        Returns: {
          store_id: string;
          store_name: string;
          address: string;
          lat: number;
          lng: number;
          is_open: boolean;
          offers_delivery: boolean;
          distance_km: number;
          total_price: number;
          missing_medicines: string[];
        }[];
      };
      place_order: {
        Args: {
          p_store_id: string;
          p_fulfilment_type: string;
          p_items: Json;
          p_delivery_address?: string | null;
          p_delivery_pincode?: string | null;
          p_prescription_path?: string | null;
        };
        Returns: Json;
      };
      expire_pending_orders: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Store = Database['public']['Tables']['stores']['Row'];
export type Medicine = Database['public']['Tables']['medicines']['Row'];
export type StoreInventory = Database['public']['Tables']['store_inventory']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type AppNotification = Database['public']['Tables']['notifications']['Row'];
export type OrderStatus = 'pending' | 'accepted' | 'ready' | 'out_for_delivery' | 'completed' | 'rejected' | 'cancelled' | 'expired' | 'not_collected';
export type FulfilmentType = 'pickup' | 'delivery';
export type UserRole = 'customer' | 'store_owner';

export type NearbyStore = Database['public']['Functions']['nearby_stores']['Returns'][number];
export type PlaceOrderResult = { order_id: string; handover_code: string; total: number };
