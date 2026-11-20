export type Email = { to: string; subject: string; text: string };

/** Sends transactional email. Swappable so tests and development never send real mail. */
export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Development fallback: prints the email instead of sending it. */
export class ConsoleMailer implements Mailer {
  async send(email: Email) {
    console.info(`[mail] to=${email.to} subject="${email.subject}"\n${email.text}`);
  }
}

/** Sends email through the Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendMailer implements Mailer {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(email: Email) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [email.to], subject: email.subject, text: email.text }),
    });
    if (!response.ok) {
      throw new Error(`Resend rejected the email (${response.status}): ${await response.text()}`);
    }
  }
}

/** Collects emails in memory; used by tests. */
export class MemoryMailer implements Mailer {
  readonly sent: Email[] = [];

  async send(email: Email) {
    this.sent.push(email);
  }

  last() {
    return this.sent.at(-1);
  }
}

export function createMailer(options: { resendApiKey?: string; from: string }): Mailer {
  return options.resendApiKey ? new ResendMailer(options.resendApiKey, options.from) : new ConsoleMailer();
}
