// Thin wrapper around the Telegram Bot API. Uses fetch (Node 20+).

const API = "https://api.telegram.org";

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
}

export interface TgMessage {
  message_id: number;
  from?: { id: number; first_name?: string; username?: string };
  chat: { id: number; type: string };
  date: number; // unix seconds
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: { file_id: string; file_unique_id: string; mime_type?: string; file_name?: string; file_size?: number };
}

export interface TgPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export class Telegram {
  constructor(private readonly token: string) {}

  private url(method: string): string {
    return `${API}/bot${this.token}/${method}`;
  }

  async getUpdates(offset: number, timeoutSec = 0): Promise<TgUpdate[]> {
    const res = await fetch(this.url("getUpdates"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        offset,
        timeout: timeoutSec,
        allowed_updates: ["message"],
      }),
    });
    const json = await res.json() as { ok: boolean; result?: TgUpdate[]; description?: string };
    if (!json.ok) throw new Error(`getUpdates failed: ${json.description}`);
    return json.result ?? [];
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    const res = await fetch(this.url("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_notification: false,
      }),
    });
    const json = await res.json() as { ok: boolean; description?: string };
    if (!json.ok) {
      // Don't crash the whole workflow on a single bad DM — e.g. user blocked the bot.
      console.warn(`sendMessage to ${chatId} failed: ${json.description}`);
    }
  }

  async getFilePath(fileId: string): Promise<string> {
    const res = await fetch(this.url("getFile"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    const json = await res.json() as { ok: boolean; result?: { file_path: string }; description?: string };
    if (!json.ok || !json.result) throw new Error(`getFile failed: ${json.description}`);
    return json.result.file_path;
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const res = await fetch(`${API}/file/bot${this.token}/${filePath}`);
    if (!res.ok) throw new Error(`download ${filePath} failed: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
}

// Pick the largest photo from a Telegram photo array (they come sorted small→large).
export function bestPhoto(photos: TgPhotoSize[]): TgPhotoSize {
  return photos[photos.length - 1];
}
