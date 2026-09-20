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

/**
 * Канонічний ISO-UTC для довільного рядка дати, або `null`, якщо дата не читається.
 *
 * `Lead.createdAt` — просто `string`, і «2026-09-09T10:30:00Z» для типу валідне.
 * Записати таке значення в стан не можна: наступний `loadState` відхилить його
 * як неочікувану форму, і синхронізація зупиниться на власному ж записі.
 */
export function toCanonicalIsoUtc(value: string): string | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Рівно той формат, який пише saveState: `Date.toISOString()`, без інших написань. */
function isCanonicalIsoUtc(value: string): boolean {
  return toCanonicalIsoUtc(value) === value;
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
 *
 * Невдача запису — теж значення, а не виняток: саме ENOSPC тут і почав інцидент,
 * і викликач має побачити його як помилку, а не отримати необроблений throw.
 */
export function saveState(path: string, state: SyncState): Result<void> {
  const tmpPath = `${path}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(state, null, 2));
    renameSync(tmpPath, path);
    return { ok: true, value: undefined };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `sync-state: cannot write ${path}: ${reason}` };
  }
}
