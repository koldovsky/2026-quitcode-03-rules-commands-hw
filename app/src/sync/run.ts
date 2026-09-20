// Один запуск синхронізації. Планувальник викликає його кожні 5 хвилин.
import { log } from "../core/log.js";
import type { Integration, Lead } from "../core/types.js";
import { loadState, saveState, toCanonicalIsoUtc } from "./state.js";

export interface SyncReport {
  pending: number;
  delivered: number;
  failed: number;
}

/** Лід разом із канонічною датою: у стан і в порівняння йде саме вона. */
interface PendingLead {
  lead: Lead;
  createdAt: string;
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

  // `Lead.createdAt` — це string, тож «2026-09-09T10:30:00Z» типу не суперечить.
  // Порівнюємо й записуємо лише канонічну форму: інакше рядковий > дає хибний
  // порядок, а записаний у стан неканонічний рядок зупинить наступний прогін.
  const pending: PendingLead[] = [];
  for (const lead of leads) {
    const createdAt = toCanonicalIsoUtc(lead.createdAt);
    if (createdAt === null) {
      log.error(`sync: lead ${lead.id} має нерозбірливий createdAt "${lead.createdAt}", пропущено`);
      continue;
    }
    if (createdAt > state.value.lastSyncedAt) pending.push({ lead, createdAt });
  }
  pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let delivered = 0;
  let failed = 0;
  let checkpoint = state.value.lastSyncedAt;
  let checkpointStalled = false;

  for (const { lead, createdAt } of pending) {
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
      checkpoint = createdAt;
      const saved = saveState(statePath, { lastSyncedAt: checkpoint });
      if (!saved.ok) {
        // Не зберегли прогрес — продовжувати не можна: наступний запуск
        // розішле те саме ще раз. Це і є ENOSPC із нічного інциденту.
        log.error(`sync: ${saved.error}; розсилку зупинено`);
        return { pending: pending.length, delivered, failed };
      }
    }
  }

  const saved = saveState(statePath, { lastSyncedAt: checkpoint });
  if (!saved.ok) log.error(`sync: ${saved.error}`);
  log.info(`sync: ${pending.length} pending leads, ${delivered} delivered, ${failed} failed`);
  return { pending: pending.length, delivered, failed };
}
