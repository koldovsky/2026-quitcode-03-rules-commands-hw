// Один запуск синхронізації. Планувальник викликає його кожні 5 хвилин.
import { log } from "../core/log.js";
import type { Integration, Lead, Result } from "../core/types.js";
import { loadState, saveState, type SyncState } from "./state.js";

export interface SyncReport {
  pending: number;
  delivered: number;
  failed: number;
}

const EMPTY: SyncReport = { pending: 0, delivered: 0, failed: 0 };

/**
 * Курсор — пара `(createdAt, id)`, а не сама дата.
 *
 * Знахідка рев'ю CodeRabbit (PR #4): з курсором лише за датою два ліди з
 * однаковим `createdAt` втрачаються назавжди. Після чекпойнта першого з них
 * аварійне завершення лишає в стані цю ж дату, а фільтр `>` наступного запуску
 * відсікає обидва — другий лід не буде розісланий ніколи. Пара з id робить
 * курсор строгим порядком: «усе до цього ліда включно».
 */
const isAfterCursor = (lead: Lead, cursor: SyncState): boolean =>
  lead.createdAt > cursor.lastSyncedAt ||
  (lead.createdAt === cursor.lastSyncedAt && lead.id > (cursor.lastLeadId ?? ""));

const byCursor = (a: Lead, b: Lead): number =>
  a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);

export async function runSync(
  leads: readonly Lead[],
  integrations: readonly Integration[],
  statePath: string,
): Promise<Result<SyncReport>> {
  const state = loadState(statePath);
  if (!state.ok) {
    // Не знаємо, що вже розіслано, — не розсилаємо нічого. Почати «з нуля»
    // означало б зробити рівно те, на що скаржився клієнт 10.09.
    log.error(`sync: стан не прочитано (${state.error}); розсилку зупинено, потрібне втручання людини`);
    return { ok: false, error: `sync: стан не прочитано (${state.error})` };
  }

  // Порядок гарантує, що чекпойнт нижче зростає монотонно — за парою (дата, id).
  const pending = leads.filter((lead) => isAfterCursor(lead, state.value)).slice().sort(byCursor);

  if (pending.length === 0) {
    const saved = saveState(statePath, state.value); // створює файл при першому запуску
    // Тут помилка не втрачає даних: розсилати нічого, курсор не зрушив.
    if (!saved.ok) log.warn(`sync: ${saved.error}`);
    log.info("sync: 0 pending leads, 0 delivered, 0 failed");
    return { ok: true, value: { ...EMPTY } };
  }

  let delivered = 0;
  let failed = 0;

  for (const lead of pending) {
    for (const integration of integrations) {
      const result = await integration.send(lead);
      if (result.ok) delivered++;
      else failed++;
    }

    // Чекпойнт після КОЖНОГО ліда. Раніше стан зберігався один раз у кінці,
    // і запуск, убитий планувальником за таймаутом (SIGKILL на 4m30s), не
    // лишав по собі жодного прогресу — наступний починав з того самого місця.
    const saved = saveState(statePath, { lastSyncedAt: lead.createdAt, lastLeadId: lead.id });
    if (!saved.ok) {
      // Лід доставлено, а курсор не зрушив: наступний запуск доставить його
      // ВДРУГЕ. Це не «звіт із нулями», а помилка, і вона має дійти до
      // планувальника як значення (`.claude/rules/conventions.md` §1).
      log.error(`sync: ${saved.error}; зупиняюсь після ліда ${lead.id}, щоб не розсилати повторно`);
      return {
        ok: false,
        error: `sync: чекпойнт не збережено після ліда ${lead.id} (${saved.error}); ` +
          `доставлено ${delivered}, з помилкою ${failed}, у черзі було ${pending.length}`,
      };
    }
  }

  log.info(`sync: ${pending.length} pending leads, ${delivered} delivered, ${failed} failed`);
  return { ok: true, value: { pending: pending.length, delivered, failed } };
}
