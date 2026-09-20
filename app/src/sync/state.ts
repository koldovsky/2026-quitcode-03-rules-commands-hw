// Стан синхронізації між запусками: ліди, створені після lastSyncedAt, ще не розіслані.
//
// Читання стану — місце нічного інциденту 10.09.2026. ENOSPC обірвав запис, файл
// лишився порожнім, а loadState мовчки підставляв INITIAL_STATE: пошкодження диска
// перетворювалось на валідний стан «ми ще ніколи не синхронізувались», і воркер
// дев'ять годин розсилав усю історію лідів заново. Тому пошкоджений файл тепер —
// помилка як значення, а не «значення за замовчуванням».
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Result } from "../core/types.js";

export interface SyncState {
  /** ISO-8601, UTC. */
  lastSyncedAt: string;
}

const INITIAL_STATE: SyncState = { lastSyncedAt: "1970-01-01T00:00:00.000Z" };

/** Рівно той формат, який пише saveState: `Date.toISOString()`, без інших написань. */
function isCanonicalIsoUtc(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

const isSyncState = (value: unknown): value is SyncState =>
  isRecord(value) && isString(value.lastSyncedAt) && isCanonicalIsoUtc(value.lastSyncedAt);

/**
 * Відсутній файл — це легітимний перший запуск, а не помилка.
 * Будь-що інше (нечитабельний файл, невалідний JSON, неочікувана форма) — помилка,
 * яку видно в журналі. Тихо почати з 1970 не можна: саме так виникають дублікати.
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
 * Запис атомарний: спершу тимчасовий файл, потім rename. Прямий writeFileSync
 * обрізає файл до нуля ще до запису, тож збій на диску лишав пошкоджений стан
 * на місці робочого — один із підсилювачів інциденту.
 */
export function saveState(path: string, state: SyncState): void {
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2));
  renameSync(tmpPath, path);
}
