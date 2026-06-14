import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CapitalStackRow,
  DueDiligenceRow,
  FinancialModelRow,
  InvestorDashboardRow,
  InvestorDocumentRow,
  InvestorReportRow,
  InvestorReportType,
  InvestorRow,
} from "@/types/phase8";

export async function fetchInvestors(supabase: SupabaseClient): Promise<InvestorRow[]> {
  const { data, error } = await supabase.from("investors").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvestorRow[];
}

export async function createInvestor(
  supabase: SupabaseClient,
  input: Omit<InvestorRow, "id" | "owner_id" | "created_at" | "updated_at">,
): Promise<InvestorRow> {
  const { data, error } = await supabase.from("investors").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as InvestorRow;
}

export async function inviteInvestorByEmail(
  supabase: SupabaseClient,
  input: { email: string; display_name?: string; organization?: string; role?: InvestorRow["role"] },
): Promise<string> {
  const email = input.email.trim();
  if (!email) throw new Error("Email is required");

  const { data, error } = await supabase.rpc("invite_investor_by_email", {
    p_email: email,
    p_display_name: input.display_name?.trim() || null,
    p_organization: input.organization?.trim() || null,
    p_role: input.role ?? "investor",
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function fetchInvestorDashboard(supabase: SupabaseClient): Promise<InvestorDashboardRow[]> {
  const { data, error } = await supabase.rpc("get_investor_dashboard");
  if (error) throw new Error(error.message);
  return (data ?? []) as InvestorDashboardRow[];
}

export async function fetchInvestorDocuments(supabase: SupabaseClient): Promise<InvestorDocumentRow[]> {
  const { data, error } = await supabase.from("investor_documents").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvestorDocumentRow[];
}

export async function createInvestorDocument(
  supabase: SupabaseClient,
  input: Omit<InvestorDocumentRow, "id" | "owner_id" | "created_at" | "updated_at">,
): Promise<InvestorDocumentRow> {
  const { data, error } = await supabase.from("investor_documents").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as InvestorDocumentRow;
}

export async function fetchFinancialModels(supabase: SupabaseClient): Promise<FinancialModelRow[]> {
  const { data, error } = await supabase.from("financial_models").select("*").order("scenario_mgd", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as FinancialModelRow[];
}

export async function upsertFinancialModel(
  supabase: SupabaseClient,
  input: Omit<FinancialModelRow, "id" | "owner_id" | "cash_flow" | "created_at" | "updated_at">,
): Promise<FinancialModelRow> {
  const { data, error } = await supabase
    .from("financial_models")
    .upsert(input, { onConflict: "owner_id,project_id,scenario_mgd" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as FinancialModelRow;
}

export async function fetchCapitalStack(supabase: SupabaseClient): Promise<CapitalStackRow[]> {
  const { data, error } = await supabase.from("capital_stack").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CapitalStackRow[];
}

export async function upsertCapitalStack(
  supabase: SupabaseClient,
  input: Omit<CapitalStackRow, "id" | "owner_id" | "total_capital" | "created_at" | "updated_at">,
): Promise<CapitalStackRow> {
  const { data, error } = await supabase
    .from("capital_stack")
    .upsert(input, { onConflict: "owner_id,project_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CapitalStackRow;
}

export async function fetchDueDiligence(supabase: SupabaseClient): Promise<DueDiligenceRow[]> {
  const { data, error } = await supabase.from("due_diligence").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DueDiligenceRow[];
}

export async function createDueDiligenceItem(
  supabase: SupabaseClient,
  input: Omit<DueDiligenceRow, "id" | "owner_id" | "created_at" | "updated_at">,
): Promise<DueDiligenceRow> {
  const { data, error } = await supabase.from("due_diligence").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data as DueDiligenceRow;
}

export async function fetchInvestorReports(supabase: SupabaseClient): Promise<InvestorReportRow[]> {
  const { data, error } = await supabase.from("investor_reports").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvestorReportRow[];
}

export async function createInvestorReport(
  supabase: SupabaseClient,
  input: {
    investor_id?: string | null;
    project_id?: string | null;
    report_type: InvestorReportType;
    title?: string | null;
    parameters?: Record<string, unknown>;
    status?: "generated" | "failed";
  },
): Promise<InvestorReportRow> {
  const { data, error } = await supabase
    .from("investor_reports")
    .insert({
      investor_id: input.investor_id ?? null,
      project_id: input.project_id ?? null,
      report_type: input.report_type,
      title: input.title ?? null,
      parameters: input.parameters ?? {},
      status: input.status ?? "generated",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as InvestorReportRow;
}
