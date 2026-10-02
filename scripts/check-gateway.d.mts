// Types for check-gateway.mjs (plain JavaScript, so the check runs without a build or tsx).

export function messagesUrl(base: string): string;
export function replyText(json: unknown): string;
export interface GatewayResult {
  ok: boolean;
  status: number;
  text: string;
  secs: number;
  raw?: string;
  error?: string;
}
export function checkGateway(opts: { base: string; token: string; model: string }): Promise<GatewayResult>;
