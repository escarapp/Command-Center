export const PROJECT_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export type ProjectRow = {
  id: string;
  organization_id: string | null;
  name: string;
  estimated_mgd: number | null;
  revenue: number | null;
  priority: ProjectPriority;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationRow = {
  id: string;
  name: string;
  org_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FundingProgramRow = {
  id: string;
  name: string;
  agency: string | null;
  eligibility: string | null;
  deadline: string | null; // date
  notes: string | null;
  url: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  bucket: string;
  path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};
