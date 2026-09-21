#!/usr/bin/env node
// PreToolUse-хук (Claude Code і Cursor): блокує Edit/Write у app/src/core/**.
// Читає JSON з stdin, бере шлях файлу з tool_input, нормалізує роздільники
// (щоб працювало і на Windows), і якщо шлях потрапляє під app/src/core/ —
// пише причину в stderr і виходить з кодом 2 (це і є сигнал "заблокувати дію"
// і для Claude Code, і для Cursor).

const PROTECTED_PREFIX = "app/src/core/";

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function normalize(p) {
  return String(p ?? "").replace(/\\/g, "/");
}

// Різні інструменти можуть класти шлях у трохи різні поля payload'у —
// перевіряємо найімовірніші, щоб хук не мовчав через розбіжність форматів.
function extractPath(payload) {
  const input = payload?.tool_input ?? payload?.toolInput ?? {};
  return (
    input.file_path ??
    input.filePath ??
    input.path ??
    payload?.file_path ??
    payload?.filePath ??
    null
  );
}

function isProtected(rawPath) {
  if (!rawPath) return false;
  const p = normalize(rawPath);
  // Порівнюємо і за абсолютним, і за відносним варіантом шляху:
  // беремо все, що йде після "app/src/core/", незалежно від того,
  // з якого кореня почався сам шлях.
  const idx = p.toLowerCase().indexOf(PROTECTED_PREFIX);
  return idx !== -1;
}

async function main() {
  let raw;
  try {
    raw = await readStdin();
  } catch {
    // Немає stdin — пропускаємо, нічого блокувати нічим.
    process.exit(0);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Невалідний JSON на вході — не наша справа блокувати, пропускаємо.
    process.exit(0);
  }

  const filePath = extractPath(payload);

  if (isProtected(filePath)) {
    process.stderr.write(
      `app/src/core/** захищено (.claude/rules/do-not-touch.md): ` +
        `зміни йдуть окремим PR через рев'ю платформної команди. ` +
        `Заблоковано спробу редагувати "${filePath}". ` +
        `Якщо задача без цього не виконується — зупинись і опиши, ` +
        `що саме треба змінити в core і навіщо.\n`
    );
    process.exit(2);
  }

  process.exit(0);
}

main();
