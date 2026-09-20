// Один запуск синхронізації. Планувальник викликає його кожні 5 хвилин.
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
  const state = loadState(statePath);
  if (!state.ok) {
    // Пошкоджений стан не означає «починаємо з нуля»: це зупинка з видимою
    // помилкою. Інакше воркер розішле всю історію лідів заново (інцидент 10.09).
    log.error(`sync: ${state.error}; розсилку зупинено, стан не перезаписано`);
    return { pending: 0, delivered: 0, failed: 0 };
  }

  // filter повертає новий масив, тож сортування на місці вхідні дані не чіпає.
  const pending = leads
    .filter((lead) => lead.createdAt > state.value.lastSyncedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let delivered = 0;
  let failed = 0;
  let checkpoint = state.value.lastSyncedAt;
  let checkpointStalled = false;

  for (const lead of pending) {
    let leadFullyDelivered = true;
    for (const integration of integrations) {
      const result = await integration.send(lead);
      if (result.ok) {
        delivered++;
      } else {
        failed++;
        leadFullyDelivered = false;
      }
    }

    // Контрольна точка просувається одразу після ліда — і лише суцільним
    // префіксом успішних. Прогін, убитий по таймауту, лишає прогрес; лід, що
    // не дійшов, не буде пропущений наступним запуском.
    if (!leadFullyDelivered) checkpointStalled = true;
    if (!checkpointStalled) {
      checkpoint = lead.createdAt;
      saveState(statePath, { lastSyncedAt: checkpoint });
    }
  }

  saveState(statePath, { lastSyncedAt: checkpoint });
  log.info(`sync: ${pending.length} pending leads, ${delivered} delivered, ${failed} failed`);
  return { pending: pending.length, delivered, failed };
}
