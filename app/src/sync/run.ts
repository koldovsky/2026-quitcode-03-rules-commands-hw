// Один запуск синхронізації. Планувальник викликає його кожні 5 хвилин.
//
// Інцидент 09–10.09.2026: чекпоінт зберігався лише в кінці пакета, а планувальник
// вбивав прогін на 4х30с — тож прогрес не фіксувався ніколи. Тому стан тепер
// зберігається після кожного повністю доставленого ліда.
import { log } from "../core/log.js";
import type { Integration, Lead } from "../core/types.js";
import { loadState, saveState } from "./state.js";

export interface SyncReport {
  pending: number;
  delivered: number;
  failed: number;
}

export async function runSync(
  leads: readonly Lead[],
  integrations: readonly Integration[],
  statePath: string,
): Promise<SyncReport> {
  const loaded = loadState(statePath);
  if (!loaded.ok) {
    // Пошкоджений стан не перезаписуємо: інакше помилкова дата стане «легітимною».
    log.error(`sync: ${loaded.error} — зупиняюсь без розсилки, стан лишаю як є`);
    return { pending: 0, delivered: 0, failed: 0 };
  }
  const state = loaded.value;

  // Хронологічний порядок робить lastSyncedAt справжньою верхньою межею:
  // усе до неї вже доставлено, усе після — ще ні.
  const pending = leads
    .filter((lead) => lead.createdAt > state.lastSyncedAt)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));

  let delivered = 0;
  let failed = 0;
  let checkpoint = state.lastSyncedAt;

  for (const lead of pending) {
    let leadDelivered = true;
    for (const integration of integrations) {
      const result = await integration.send(lead);
      if (result.ok) {
        delivered++;
      } else {
        failed++;
        leadDelivered = false;
      }
    }

    if (!leadDelivered) {
      // Не просуваємо чекпоінт повз недоставлений лід — інакше він зникне назавжди.
      log.warn(`sync: lead ${lead.id} not fully delivered, stopping before it`);
      break;
    }

    if (lead.createdAt > checkpoint) checkpoint = lead.createdAt;
    const saved = saveState(statePath, { lastSyncedAt: checkpoint });
    if (!saved.ok) {
      log.error(`sync: ${saved.error} — зупиняюсь, щоб не дублювати вже надіслане`);
      break;
    }
  }

  if (pending.length === 0 && checkpoint === state.lastSyncedAt) {
    // Перший запуск без нових лідів: створюємо файл стану, щоб він існував.
    const saved = saveState(statePath, state);
    if (!saved.ok) log.error(`sync: ${saved.error}`);
  }

  log.info(`sync: ${pending.length} pending leads, ${delivered} delivered, ${failed} failed`);
  return { pending: pending.length, delivered, failed };
}
