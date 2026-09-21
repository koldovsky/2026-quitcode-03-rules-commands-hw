// Стан синхронізації між запусками: ліди, створені після lastSyncedAt, ще не розіслані.
//
// Цей файл — місце нічного інциденту 10.09.2026 (materials/error-log.txt).
// Було дві вади, і саме їх поєднання перетворило разове переповнення диска
// на дев'ять годин дублікатів:
//   1) writeFileSync відкриває файл із прапорцем `w` — спершу обрізає, потім
//      пише. Падіння на ENOSPC лишало на диску не старий стан, а ПОРОЖНІЙ файл.
//   2) `catch { return INITIAL_STATE }` ковтав помилку розбору й мовчки
//      повертав 1970 — тобто «усі ліди нові».
// Тепер запис атомарний (tmp + rename), а нечитабельний стан — це помилка як
// значення, яку видно в журналі (`.claude/rules/conventions.md` §1 і §4).
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Result } from "../core/types.js";

export interface SyncState {
  /** ISO-8601, UTC, канонічна форма `YYYY-MM-DDTHH:mm:ss.sssZ`. */
  lastSyncedAt: string;
  /**
   * id останнього розісланого ліда — розв'язує нічию за `createdAt`.
   * Необов'язковий: стан, збережений до цієї зміни, лишається читабельним.
   */
  lastLeadId?: string;
}

export const INITIAL_STATE: SyncState = { lastSyncedAt: "1970-01-01T00:00:00.000Z", lastLeadId: "" };

/**
 * Курсор порівнюється рядково (`lead.createdAt > lastSyncedAt`), тому форма
 * timestamp — частина контракту, а не косметика. `{"lastSyncedAt":"z"}` — валідний
 * рядок, який більший за будь-яку ISO-дату: жоден лід не пройде фільтр, і
 * синхронізація тихо зупиниться назавжди. `""` дає дзеркальну ваду — проходять усі.
 * Тому перевіряємо канонічну форму, а не лише тип. Знахідка рев'ю CodeRabbit, PR #4.
 */
const CANONICAL_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const isCanonicalUtc = (value: unknown): value is string =>
  isString(value) && CANONICAL_UTC.test(value) && !Number.isNaN(Date.parse(value));

const isSyncState = (value: unknown): value is SyncState =>
  isRecord(value) &&
  isCanonicalUtc(value.lastSyncedAt) &&
  (value.lastLeadId === undefined || isString(value.lastLeadId));

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Відсутній файл — це перший запуск, а не помилка.
 * Файл, який є, але не читається чи не має очікуваної форми, — помилка:
 * мовчки почати з 1970 означає розіслати всю базу лідів заново.
 */
export function loadState(path: string): Result<SyncState> {
  if (!existsSync(path)) return { ok: true, value: { ...INITIAL_STATE } };

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    return { ok: false, error: `sync-state: не вдалось прочитати ${path}: ${reason(error)}` };
  }

  return parseJson(text, isSyncState, "sync-state");
}

/**
 * Атомарний запис: спершу у тимчасовий файл, потім rename у межах тієї самої
 * файлової системи. Обрив на будь-якому кроці лишає попередній стан цілим —
 * саме цього бракувало в ніч інциденту.
 */
export function saveState(path: string, state: SyncState): Result<void> {
  const tmp = `${path}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    renameSync(tmp, path);
    return { ok: true, value: undefined };
  } catch (error) {
    // Прибирання не має підміняти собою причину: якщо тимчасовий файл не
    // видаляється (наприклад, на його місці тека), назовні все одно йде
    // початкова помилка запису, а не помилка прибирання.
    try {
      rmSync(tmp, { force: true, recursive: true });
    } catch {
      /* лишаємо як є: причину нижче це не змінює */
    }
    return { ok: false, error: `sync-state: не вдалось зберегти ${path}: ${reason(error)}` };
  }
}
