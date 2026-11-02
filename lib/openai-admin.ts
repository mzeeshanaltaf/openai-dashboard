import "server-only";

import { parseLineItem } from "@/lib/line-item";
import type { ApiKey, CostRow, Project, UsageCategory, UsageRow } from "@/lib/types";

const BASE = "https://api.openai.com/v1";
const TTL_MS = 5 * 60 * 1000;

type Params = Record<string, string | number | string[] | undefined>;

type Page<T> = {
  data: T[];
  has_more?: boolean;
  next_page?: string | null;
  last_id?: string | null;
};

type Bucket<R> = { start_time: number; end_time: number; results: R[] };

const cache = new Map<string, { at: number; value: Promise<unknown> }>();

function buildUrl(path: string, params: Params) {
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function request<T>(url: string): Promise<T> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) throw new Error("OPENAI_ADMIN_KEY is not set");

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI ${res.status} on ${new URL(url).pathname}: ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }
}

// Fetches every page of a paginated endpoint, caching the combined result per URL.
function getAll<T>(path: string, params: Params, fresh: boolean, cursor: "page" | "after"): Promise<T[]> {
  const cacheKey = buildUrl(path, params);
  const hit = cache.get(cacheKey);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T[]>;

  const value = (async () => {
    const items: T[] = [];
    let next: string | undefined;
    do {
      const page = await request<Page<T>>(
        buildUrl(path, { ...params, ...(next ? { [cursor]: next } : {}) })
      );
      items.push(...page.data);
      next = page.has_more ? (cursor === "page" ? page.next_page : page.last_id) ?? undefined : undefined;
    } while (next);
    return items;
  })();

  cache.set(cacheKey, { at: Date.now(), value });
  value.catch(() => cache.delete(cacheKey));
  return value;
}

const day = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);

export async function getProjects(fresh = false): Promise<Project[]> {
  type Raw = { id: string; name: string; status: string; created_at: number };
  const raw = await getAll<Raw>(
    "/organization/projects",
    { limit: 100, include_archived: "true" },
    fresh,
    "after"
  );
  return raw.map((p) => ({ id: p.id, name: p.name, status: p.status, createdAt: p.created_at }));
}

export async function getApiKeys(projects: Project[], fresh = false): Promise<ApiKey[]> {
  type Raw = {
    id: string;
    name: string;
    redacted_value: string;
    created_at: number;
    last_used_at: number | null;
    owner?: { user?: { name?: string }; service_account?: { name?: string } };
  };
  const perProject = await Promise.all(
    projects.map(async (project) => {
      const raw = await getAll<Raw>(
        `/organization/projects/${project.id}/api_keys`,
        { limit: 100 },
        fresh,
        "after"
      ).catch(() => [] as Raw[]); // archived projects may reject key listing
      return raw.map<ApiKey>((k) => ({
        id: k.id,
        name: k.name,
        projectId: project.id,
        redacted: k.redacted_value,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
        ownerName: k.owner?.user?.name ?? k.owner?.service_account?.name ?? null,
      }));
    })
  );
  return perProject.flat();
}

export async function getCosts(startTime: number, endTime: number, fresh = false): Promise<CostRow[]> {
  type Raw = {
    amount: { value: number | string };
    project_id: string | null;
    api_key_id: string | null;
    line_item: string | null;
    quantity: number | null;
  };
  const buckets = await getAll<Bucket<Raw>>(
    "/organization/costs",
    {
      start_time: startTime,
      end_time: endTime,
      bucket_width: "1d",
      group_by: ["project_id", "api_key_id", "line_item"],
      limit: 180,
    },
    fresh,
    "page"
  );
  return buckets.flatMap((b) =>
    b.results.map((r) => ({
      date: day(b.start_time),
      projectId: r.project_id,
      apiKeyId: r.api_key_id,
      lineItem: r.line_item ?? "Unattributed",
      ...parseLineItem(r.line_item),
      amount: Number(r.amount.value) || 0,
      quantity: r.quantity,
    }))
  );
}

// Lighter cost query (no grouping) used for balance and month-to-date totals.
export async function getCostTotal(startTime: number, endTime: number, fresh = false) {
  type Raw = { amount: { value: number | string }; project_id: string | null };
  const buckets = await getAll<Bucket<Raw>>(
    "/organization/costs",
    { start_time: startTime, end_time: endTime, bucket_width: "1d", group_by: ["project_id"], limit: 180 },
    fresh,
    "page"
  );
  let total = 0;
  const byProject: Record<string, number> = {};
  for (const r of buckets.flatMap((b) => b.results)) {
    const value = Number(r.amount.value) || 0;
    total += value;
    const id = r.project_id ?? "unknown";
    byProject[id] = (byProject[id] ?? 0) + value;
  }
  return { total, byProject };
}

const MODEL_GROUPED: UsageCategory[] = [
  "completions",
  "embeddings",
  "moderations",
  "images",
  "audio_speeches",
  "audio_transcriptions",
];
const PROJECT_GROUPED: UsageCategory[] = ["vector_stores", "code_interpreter_sessions"];

type RawUsage = {
  project_id?: string | null;
  api_key_id?: string | null;
  model?: string | null;
  num_model_requests?: number;
  input_tokens?: number;
  output_tokens?: number;
  input_cached_tokens?: number;
  images?: number;
  characters?: number;
  seconds?: number;
  usage_bytes?: number;
  num_sessions?: number;
  sessions?: number;
};

export async function getUsage(startTime: number, endTime: number, fresh = false): Promise<UsageRow[]> {
  const fetchCategory = async (category: UsageCategory, groupBy: string[]) => {
    const buckets = await getAll<Bucket<RawUsage>>(
      `/organization/usage/${category}`,
      { start_time: startTime, end_time: endTime, bucket_width: "1d", group_by: groupBy, limit: 31 },
      fresh,
      "page"
    );
    return buckets.flatMap((b) =>
      b.results.map<UsageRow>((r) => ({
        date: day(b.start_time),
        category,
        projectId: r.project_id ?? null,
        apiKeyId: r.api_key_id ?? null,
        model: r.model ?? null,
        requests: r.num_model_requests ?? 0,
        inputTokens: r.input_tokens ?? 0,
        outputTokens: r.output_tokens ?? 0,
        cachedTokens: r.input_cached_tokens ?? 0,
        units: r.images ?? r.characters ?? r.seconds ?? r.usage_bytes ?? r.num_sessions ?? r.sessions ?? 0,
      }))
    );
  };

  const results = await Promise.all([
    ...MODEL_GROUPED.map((c) => fetchCategory(c, ["project_id", "model", "api_key_id"])),
    ...PROJECT_GROUPED.map((c) => fetchCategory(c, ["project_id"])),
  ]);
  return results.flat();
}
