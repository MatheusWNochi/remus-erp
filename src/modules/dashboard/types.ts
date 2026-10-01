export type DashboardPeriod = '7d' | '30d' | '12m';

export type DashboardKpis = {
  activeCustomers: number;
  activeCustomersTrend: number | null;
  catalogProducts: number;
  catalogProductsTrend: number | null;
  lowStockCount: number;
  stockValue: number;
};

export type MovementFlowPoint = {
  /** ISO curto (YYYY-MM-DD para dias, YYYY-MM para meses). */
  bucket: string;
  label: string;
  in: number;
  out: number;
};

export type TopProductPoint = {
  productId: string;
  name: string;
  quantity: number;
};

export type CategorySlice = {
  name: string;
  quantity: number;
};

export type ActivityItem = {
  id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  unit: string;
  reason: string | null;
  createdAt: string;
  userName: string | null;
};

export type DashboardOverview = {
  kpis: DashboardKpis;
  flow: MovementFlowPoint[];
  topProducts: TopProductPoint[];
  categories: CategorySlice[];
  activity: ActivityItem[];
};
