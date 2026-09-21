// Стан синхронізації між запусками: ліди, створені після lastSyncedAt, ще не розіслані.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Result } from "../core/types.js";

export interface SyncState {
  /** ISO-8601, UTC. */
  lastSyncedAt: string;
}

const INITIAL_STATE: SyncState = { lastSyncedAt: "1970-01-01T00:00:00.000Z" };

const isSyncState = (value: unknown): value is SyncState =>
  isRecord(value) && isString(value.lastSyncedAt) && !Number.isNaN(Date.parse(value.lastSyncedAt));

const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Файлу немає — перший запуск: початковий стан. Файл є, але не читається чи має не ту
 * форму — помилка: тихо почати з 1970 означає розіслати всю історію заново.
 */
export function loadState(path: string): Result<SyncState> {
  if (!existsSync(path)) {
    log.warn(`sync state: ${path} not found, starting from the beginning`);
    return { ok: true, value: { ...INITIAL_STATE } };
  }
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    return { ok: false, error: `sync state: cannot read ${path}: ${describeError(error)}` };
  }
  return parseJson(text, isSyncState, "sync state");
}

/** Атомарно: пише в тимчасовий файл і перейменовує, тож збій запису не псує попередній стан. */
export function saveState(path: string, state: SyncState): Result<void> {
  const tmpPath = `${path}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(state, null, 2));
    renameSync(tmpPath, path);
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, error: `sync state: cannot save ${path}: ${describeError(error)}` };
  }
}
