const { exec } = require('child_process');

const INTERVAL = 5 * 60 * 1000; // 5 minutos

function run(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error && !stdout.includes("nothing to commit")) {
        console.log("❌ Error:", error.message);
        return resolve(null);
      }
      resolve(stdout || stderr);
    });
  });
}

async function autoPush() {
  console.log("🔄 Revisando cambios...");

  await run("git add .");

  const status = await run("git status --porcelain");

  if (!status || !status.trim()) {
    console.log("✅ Sin cambios");
    return;
  }

  const time = new Date().toLocaleString();

  await run(`git commit -m "Auto-update: ${time}"`);
  await run("git push origin main");

  console.log("🚀 Cambios subidos a GitHub");
}

// Ejecutar una vez al inicio
autoPush();

// Ejecutar cada 5 minutos
setInterval(autoPush, INTERVAL);