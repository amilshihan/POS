export type UserRole = "admin" | "cashier";
export type PaymentMethod = "cash" | "credit" | "cheque" | "mixed";
export type ChequeDirection = "received" | "issued";
export type ChequeStatus = "pending" | "cleared" | "bounced";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Part {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  cost_price: number;
  sell_price: number;
  qty_on_hand: number;
  low_stock_threshold: number;
  unit: string;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  credit_balance: number;
  created_at: string;
}

export interface Sale {
  id: string;
  sale_number: string;
  customer_id: string | null;
  cashier_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amount_paid: number;
  payment_method: PaymentMethod;
  status: "completed" | "voided";
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  part_id: string;
  qty: number;
  unit_price: number;
  cost_price_snapshot: number;
  line_total: number;
}

export interface Payment {
  id: string;
  customer_id: string;
  sale_id: string | null;
  amount: number;
  method: PaymentMethod;
  received_by: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id: string;
  purchased_by: string;
  total: number;
  payment_status: "unpaid" | "partial" | "paid";
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  part_id: string;
  qty: number;
  unit_cost: number;
  line_total: number;
}

export interface Cheque {
  id: string;
  direction: ChequeDirection;
  related_sale_id: string | null;
  related_purchase_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  cheque_number: string;
  bank_name: string | null;
  amount: number;
  due_date: string;
  status: ChequeStatus;
  cleared_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// Placeholder so `import type { Database }` compiles until we generate
// real types from the live Supabase project (`supabase gen types`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
