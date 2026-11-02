"use client";

import dynamic from "next/dynamic";

import { DashboardSkeleton } from "@/components/dashboard-skeleton";

// Client-only: the dashboard derives state from dates and localStorage on first render.
const Dashboard = dynamic(() => import("@/components/dashboard"), {
  ssr: false,
  loading: () => <DashboardSkeleton />,
});

export default function Page() {
  return <Dashboard />;
}
