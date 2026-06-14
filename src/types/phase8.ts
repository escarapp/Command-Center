export type InvestorRole = "investor" | "analyst" | "admin";

export type InvestorRow = {
  id: string;
  owner_id: string;
  investor_user_id: string;
  display_name: string;
  organization: string | null;
  role: InvestorRole;
  can_view_documents: boolean;
  can_view_financials: boolean;
  can_view_reports: boolean;
  status: "active" | "invited" | "disabled";
  created_at: string;
  updated_at: string;
};

export type InvestorDocumentType =
  | "financial_model"
  | "engineering_report"
  | "permit"
  | "presentation"
  | "contract"
  | "study";

export type InvestorDocumentRow = {
  id: string;
  owner_id: string;
  investor_id: string | null;
  project_id: string | null;
  doc_type: InvestorDocumentType;
  bucket: string;
  path: string;
  filename: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialModelRow = {
  id: string;
  owner_id: string;
  investor_id: string | null;
  project_id: string | null;
  scenario_mgd: 25 | 50 | 100 | 150;
  annual_sales: number;
  om_costs: number;
  debt_service: number;
  cash_flow: number;
  assumptions: string | null;
  created_at: string;
  updated_at: string;
};

export type CapitalStackRow = {
  id: string;
  owner_id: string;
  investor_id: string | null;
  project_id: string | null;
  equity: number;
  debt: number;
  grants: number;
  wifia: number;
  swift: number;
  texas_water_fund: number;
  total_capital: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DueDiligenceRow = {
  id: string;
  owner_id: string;
  investor_id: string | null;
  project_id: string | null;
  item: string;
  status: "open" | "in_progress" | "closed";
  responsible_party: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InvestorReportType = "executive_summary" | "investment_memorandum" | "financial_summary";

export type InvestorReportRow = {
  id: string;
  owner_id: string;
  investor_id: string | null;
  project_id: string | null;
  report_type: InvestorReportType;
  title: string | null;
  parameters: Record<string, unknown> | null;
  status: "generated" | "failed";
  created_at: string;
  updated_at: string;
};

export type InvestorDashboardRow = {
  project_id: string;
  project_name: string;
  capacity_mgd: number;
  pipeline_miles: number;
  revenue_projection: number;
  funding_program_count: number;
};
