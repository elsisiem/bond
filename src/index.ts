import { Hono } from "hono";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  ANTHROPIC_API_KEY: string;
  TOKEN_SECRET: string;
  DEV_SIMULATE_SECRET: string;
  PUBLIC_BASE_URL: string;
  OWNER_EMAIL: string;
  ROOT_DOMAIN: string;
  DEMO_ALIAS: string;
  DEFAULT_BOND_CENTS: string;
  MAX_BOND_CENTS: string;
  BOND_HOLD_HOURS: string;
  WAITING_ROOM_DAYS: string;
};

const app = new Hono<{ Bindings: Env }>();
app.get("/api/health", (c) => c.json({ ok: true, name: "bond" }));

export default app;
