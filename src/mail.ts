import { Resend } from "resend";

export interface Attachment {
  filename: string;
  content: Buffer;
  content_id?: string;
}

export interface SendOptions {
  apiKey: string;
  from: string;      // "Name <email@domain>"
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
}

export async function sendEmail(opts: SendOptions): Promise<void> {
  const resend = new Resend(opts.apiKey);
  // Send one email per receiver so we don't expose their addresses to each other.
  for (const to of opts.to) {
    const payload = {
      from: opts.from,
      to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo || undefined,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
        contentId: a.content_id,
      })),
    };
    const { error } = await resend.emails.send(payload);
    if (error) {
      throw new Error(`Resend failed for ${to}: ${error.name} ${error.message}`);
    }
    console.log(`sent journal to ${to}`);
  }
}
