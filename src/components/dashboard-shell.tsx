"use client";

import { AppShell } from "@/components/app-shell";
import { RgvMap } from "@/components/rgv-map";

type DashboardShellProps = {
  userEmail: string;
};

export function DashboardShell({ userEmail }: DashboardShellProps) {
  return (
    <AppShell userEmail={userEmail}>
      <RgvMap />
    </AppShell>
  );
}
