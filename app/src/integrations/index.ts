// Реєстр інтеграцій, які запускає sync. Нова інтеграція — новий файл і рядок тут.
import type { Integration } from "../core/types.js";
import { harvest } from "./harvest.js";
import sheetsAppend from "./sheets-append.js";
import { slackNotify } from "./slack-notify.js";

export const integrations: readonly Integration[] = [slackNotify, sheetsAppend, harvest];
