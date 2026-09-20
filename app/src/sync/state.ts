// Стан синхронізації між запусками: ліди, створені після lastSyncedAt, ще не розіслані.
//
// Інцидент 09–10.09.2026: обірваний ENOSPC-запис лишив файл пошкодженим, а
// loadState мовчки підставляв 1970 рік — і воркер дев'ять годин розсилав усю
// історію лідів заново. Тому тут два правила:
//   1) пошкоджений стан — це помилка (Result), а не «значення за замовчуванням»;
//   2) запис атомарний: спершу тимчасовий файл, потім rename.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isRecord, isString, parseJson, type Guard } from "../core/parse.js";
import type { Result } from "../core/types.js";

export interface SyncState {
  /** ISO-8601, UTC. */
  lastSyncedAt: string;
}

const INITIAL_STATE: SyncState = { lastSyncedAt: "1970-01-01T00:00:00.000Z" };

/** Канонічний ISO-8601 з мілісекундами: дати порівнюються як рядки, тож формат має бути один. */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const isSyncState: Guard<SyncState> = (value): value is SyncState =>
  isRecord(value) && isString(value.lastSyncedAt) && ISO_UTC.test(value.lastSyncedAt);

/**
 * Читає стан. Відсутній файл — це штатний перший запуск.
 * Пошкоджений або неочікуваної форми — помилка: мовчки почати з 1970 року
 * означає розіслати всю історію лідів заново.
 */
export function loadState(path: string): Result<SyncState> {
  if (!existsSync(path)) return { ok: true, value: { ...INITIAL_STATE } };

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `sync-state: cannot read ${path}: ${reason}` };
  }

  return parseJson(text, isSyncState, "sync-state");
}

/**
 * Записує стан атомарно: тимчасовий файл і rename у межах тієї самої теки.
 * Обірваний запис (ENOSPC, SIGKILL) не лишає напівзаписаного цільового файлу.
 */
export function saveState(path: string, state: SyncState): Result<void> {
  const tmpPath = `${path}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(state, null, 2));
    renameSync(tmpPath, path);
    return { ok: true, value: undefined };
  } catch (error) {
    rmSync(tmpPath, { force: true });
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `sync-state: cannot write ${path}: ${reason}` };
  }
}
