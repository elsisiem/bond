export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  ANTHROPIC_API_KEY: string;
  TOKEN_SECRET: string;
  DEV_SIMULATE_SECRET: string;
  RESEND_API_KEY?: string;
  PUBLIC_BASE_URL: string;
  OWNER_EMAIL: string;
  ROOT_DOMAIN: string;
  DEMO_ALIAS: string;
  DEFAULT_BOND_CENTS: string;
  MAX_BOND_CENTS: string;
  BOND_HOLD_HOURS: string;
  WAITING_ROOM_DAYS: string;
};

export type Inbound = {
  to: string; // full address
  from: string; // envelope sender
  subject: string;
  text: string;
  headers: Record<string, string>; // lower-case keys
  size?: number;
  unverified?: boolean; // web/API intake: sender address is self-declared, so allowlist must not apply
};
