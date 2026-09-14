// Стан синхронізації між запусками: ліди, створені після lastSyncedAt, ще не розіслані.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isRecord, isString, parseJson, type Guard } from "../core/parse.js";
import type { Result } from "../core/types.js";

export interface SyncState {
  /** Канонічний ISO-8601 в UTC — у тій формі, яку дає Date.prototype.toISOString(). */
  lastSyncedAt: string;
}

export const INITIAL_STATE: SyncState = { lastSyncedAt: "1970-01-01T00:00:00.000Z" };

// runSync порівнює дати як рядки, тому приймаємо лише канонічну форму: "2026-9-9" теж
// парситься, але як рядок виглядає «новішим» за будь-який вересневий лід — і ліди губляться.
const isCanonicalIsoTime = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString() === value;
};

const isSyncState: Guard<SyncState> = (value): value is SyncState =>
  isRecord(value) && isString(value.lastSyncedAt) && isCanonicalIsoTime(value.lastSyncedAt);

/**
 * Файлу немає — це перший запуск. Файл є, але його не прочитати або він пошкоджений, —
 * це помилка, а не «перший запуск»: тихий фолбек на INITIAL_STATE і спричинив інцидент 10.09.
 */
export function loadState(path: string): Result<SyncState> {
  if (!existsSync(path)) return { ok: true, value: { ...INITIAL_STATE } };

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `sync-state ${path}: unreadable (${reason})` };
  }

  return parseJson(text, isSyncState, `sync-state ${path}`);
}

/** Атомарний запис: перерваний запис лишає попередній файл, а не обрізаний. */
export function saveState(path: string, state: SyncState): void {
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2));
  renameSync(tmpPath, path);
}
