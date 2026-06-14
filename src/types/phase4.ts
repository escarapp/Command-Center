export type MeetingBriefAudience = "executive" | "investor" | "legislative";

export type MeetingBriefRow = {
  id: string;
  project_id: string | null;
  organization_id: string | null;
  audience: MeetingBriefAudience;
  title: string;
  brief_text: string;
  created_at: string;
  updated_at: string;
};

export type RiskRegisterRow = {
  id: string;
  project_id: string | null;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  description: string;
  mitigation: string | null;
  status: "open" | "monitoring" | "closed";
  created_at: string;
  updated_at: string;
};

export type DashboardSnapshotRow = {
  id: string;
  snapshot_type: string;
  params: unknown;
  snapshot: unknown;
  created_at: string;
};

export type ExportHistoryRow = {
  id: string;
  export_type: string;
  params: unknown;
  file_name: string;
  created_at: string;
};
