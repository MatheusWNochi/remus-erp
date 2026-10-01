import type { customerStatus, personType } from '@/generated/prisma/enums';

export type CustomerStatus = customerStatus;
export type PersonType = personType;

/** DTO serializável devolvido pelas server actions (sem Decimal/Date cru). */
export type CustomerListItem = {
  id: string;
  name: string;
  personType: PersonType;
  document: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  status: CustomerStatus;
  createdAt: string;
};

export type CustomerDetail = CustomerListItem & {
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  notes: string | null;
  updatedAt: string;
};

export type CustomerListParams = {
  search?: string;
  status?: CustomerStatus | 'ALL';
  state?: string | 'ALL';
  page: number;
  pageSize: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
};

export type CustomerListResult = {
  rows: CustomerListItem[];
  total: number;
  /** UFs presentes na base, para alimentar o filtro sem uma segunda chamada. */
  states: string[];
};
