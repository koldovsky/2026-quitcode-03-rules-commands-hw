// Один запуск синхронізації. Планувальник викликає його кожні 5 хвилин.
import { readEnv } from "../core/config.js";
import { log } from "../core/log.js";
import type { Integration, Lead } from "../core/types.js";
import { loadState, saveState } from "./state.js";

export interface SyncReport {
  pending: number;
  delivered: number;
  failed: number;
  /** Заповнено, якщо запуск зупинено: немає змінних середовища, пошкоджений стан або доставка не вдалася. */
  error?: string;
}

function stopped(error: string, pending = 0, delivered = 0, failed = 0): SyncReport {
  log.error(`sync: run stopped: ${error}`);
  return { pending, delivered, failed, error };
}

export async function runSync(
  leads: readonly Lead[],
  integrations: readonly Integration[],
  statePath: string,
): Promise<SyncReport> {
  // Без змінних середовища інтеграція гарантовано не доставить лід — зупиняємось до розсилки.
  const missingEnv = integrations.flatMap((integration) =>
    integration.requiredEnv.filter((name) => !readEnv(name).ok).map((name) => `${integration.name}: ${name}`),
  );
  if (missingEnv.length > 0) return stopped(`missing environment variables — ${missingEnv.join(", ")}`);

  const state = loadState(statePath);
  // Пошкоджений стан — не «перший запуск». Нічого не розсилаємо й файл не перезаписуємо:
  // його має відновити людина. Розіслати всю історію повторно — дорожче за пропущений тик.
  if (!state.ok) return stopped(`state is unreadable: ${state.error}`);

  const pending = leads
    .filter((lead) => lead.createdAt > state.value.lastSyncedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let delivered = 0;
  let failed = 0;

  for (const lead of pending) {
    for (const integration of integrations) {
      const result = await integration.send(lead);
      if (result.ok) {
        delivered++;
        continue;
      }
      failed++;
      // Чекпоінт не просуваємо: наступний запуск повторить цей лід. Інтеграції, які вже
      // доставили його, отримають повтор — «щонайменше раз» безпечніше, ніж «загубили».
      return stopped(
        `lead ${lead.id} not delivered by ${integration.name}: ${result.error}`,
        pending.length,
        delivered,
        failed,
      );
    }
    // Чекпоінт після кожного повністю доставленого ліда: обірваний запуск продовжиться звідси.
    saveState(statePath, { lastSyncedAt: lead.createdAt });
  }

  log.info(`sync: ${pending.length} pending leads, ${delivered} delivered, ${failed} failed`);
  return { pending: pending.length, delivered, failed };
}
