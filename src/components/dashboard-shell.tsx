"use client";

import { AppShell } from "@/components/app-shell";
import { RgvMap } from "@/components/rgv-map";

type DashboardShellProps = {
  userEmail: string;
  activeProjectName?: string;
};

export function DashboardShell({ userEmail, activeProjectName }: DashboardShellProps) {
  return (
    <AppShell userEmail={userEmail} activeProjectName={activeProjectName}>
      <RgvMap />
    </AppShell>
  );
}
