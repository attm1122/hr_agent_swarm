/**
 * Microsoft Teams notifications via Incoming Webhook.
 *
 * The simplest integration path: a Teams channel owner creates an Incoming
 * Webhook connector and pastes the URL into TEAMS_WEBHOOK_URL. No tenant
 * setup, no app permissions. Messages appear in the channel.
 *
 * For multi-channel routing (e.g. separate channels for different HR events),
 * accept the webhook URL per-call.
 */

export interface TeamsMessage {
  title: string;
  summary: string;
  text: string;
  /** Optional action buttons rendered as OpenUri cards. */
  actions?: Array<{ label: string; url: string }>;
  /** Optional facts (key/value rows), e.g. Employee, Date, Team. */
  facts?: Array<{ name: string; value: string }>;
  /** MessageCard themeColor, hex without `#`. Default: LEAP red-ish. */
  themeColor?: string;
}

const DEFAULT_THEME_COLOR = 'BF2E2E';

function getDefaultWebhookUrl(): string | null {
  return process.env.TEAMS_WEBHOOK_URL ?? null;
}

/**
 * Posts a MessageCard-formatted message to a Teams channel via incoming
 * webhook. If no webhookUrl is provided, falls back to the TEAMS_WEBHOOK_URL
 * env var. Throws if neither is set.
 */
export async function sendTeamsMessage(
  message: TeamsMessage,
  webhookUrl?: string,
): Promise<void> {
  const url = webhookUrl ?? getDefaultWebhookUrl();
  if (!url) {
    throw new Error(
      'Teams webhook URL not configured. Set TEAMS_WEBHOOK_URL or pass webhookUrl explicitly.',
    );
  }

  const card = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: message.themeColor ?? DEFAULT_THEME_COLOR,
    summary: message.summary,
    sections: [
      {
        activityTitle: message.title,
        text: message.text,
        facts: (message.facts ?? []).map((f) => ({
          name: f.name,
          value: f.value,
        })),
        markdown: true,
      },
    ],
    potentialAction: (message.actions ?? []).map((a) => ({
      '@type': 'OpenUri',
      name: a.label,
      targets: [{ os: 'default', uri: a.url }],
    })),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Teams webhook returned ${response.status}: ${text.slice(0, 400)}`,
    );
  }
}

export function isTeamsConfigured(): boolean {
  return Boolean(process.env.TEAMS_WEBHOOK_URL);
}
