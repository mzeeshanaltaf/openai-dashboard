// Shared shapes returned by /api/dashboard and consumed by the client.

export type UsageCategory =
  | "completions"
  | "embeddings"
  | "moderations"
  | "images"
  | "audio_speeches"
  | "audio_transcriptions"
  | "vector_stores"
  | "code_interpreter_sessions";

export type Project = {
  id: string;
  name: string;
  status: string;
  createdAt: number;
};

export type ApiKey = {
  id: string;
  name: string;
  projectId: string;
  redacted: string;
  createdAt: number;
  lastUsedAt: number | null;
  ownerName: string | null;
};

export type CostRow = {
  date: string; // YYYY-MM-DD (UTC bucket start)
  projectId: string | null;
  apiKeyId: string | null;
  lineItem: string;
  model: string;
  kind: string; // input | output | cached input | cache write | usage | ...
  tier: string; // standard | flex | batch | priority | ...
  amount: number; // USD
  quantity: number | null;
};

export type UsageRow = {
  date: string;
  category: UsageCategory;
  projectId: string | null;
  apiKeyId: string | null;
  model: string | null;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  // Category-specific unit: images, characters, seconds, bytes or sessions.
  units: number;
};

export type CreditGrant = {
  id: number;
  amountUsd: number;
  grantedAt: string; // YYYY-MM-DD
  expiresAt: string | null;
  note: string | null;
};

export type Budget = {
  scope: string; // "total" or a project id
  monthlyUsd: number;
};

export type Balance = {
  totalCredits: number;
  spent: number;
  remaining: number;
  since: string;
};

export type MonthToDate = {
  start: string;
  cost: number;
  byProject: Record<string, number>;
  daysElapsed: number;
  daysInMonth: number;
  forecast: number;
};

export type DashboardData = {
  generatedAt: number;
  range: { start: string; end: string };
  projects: Project[];
  apiKeys: ApiKey[];
  costs: CostRow[];
  usage: UsageRow[];
  mtd: MonthToDate;
  balance: Balance | null;
  grants: CreditGrant[];
  budgets: Budget[];
};
