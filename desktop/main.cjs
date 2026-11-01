const { app, BrowserWindow, dialog, ipcMain, session } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const indexPath = path.resolve(__dirname, "..", "dist", "index.html");
const appUrl = require("node:url").pathToFileURL(indexPath).href;
const allowedLanguages = new Set([
  "python", "javascript", "go", "java", "rust", "cpp", "c", "php", "ruby", "powershell", "sql",
]);
let mainWindow;

function isAppRenderer(event) {
  return mainWindow && event.sender === mainWindow.webContents;
}

function findRuntime(candidates, args = ["--version"]) {
  for (const [command, commandArgs] of candidates) {
    const result = spawnSync(command, commandArgs || args, {
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
      shell: false,
      stdio: "ignore",
    });
    if (!result.error && result.status !== null) return command;
  }
  return null;
}

function runtimeCommand(language, sourceFile, outputFile) {
  const paths = process.env.PATH || "";
  switch (language) {
    case "python": {
      const command = findRuntime([["py", ["-3", "--version"]], ["python"], ["python3"]]);
      if (!command) throw new Error("Python tidak ditemukan. Pasang Python 3 dan aktifkan opsi Add Python to PATH.");
      return command === "py" ? { command, args: ["-3", "-I", sourceFile] } : { command, args: ["-I", sourceFile] };
    }
    case "javascript": {
      const command = findRuntime([["node"]]);
      if (!command) throw new Error("Node.js tidak ditemukan di PATH.");
      return { command, args: [sourceFile] };
    }
    case "go": {
      const command = findRuntime([["go"]]);
      if (!command) throw new Error("Go tidak ditemukan di PATH.");
      return { command, args: ["run", sourceFile] };
    }
    case "java": {
      const command = findRuntime([["java"]]);
      if (!command) throw new Error("Java tidak ditemukan di PATH.");
      return { command, args: [sourceFile] };
    }
    case "rust": {
      const compiler = findRuntime([["rustc"]]);
      if (!compiler) throw new Error("rustc tidak ditemukan di PATH. Pasang Rust toolchain.");
      return { command: compiler, args: [sourceFile, "-o", outputFile], then: { command: outputFile, args: [] } };
    }
    case "cpp":
    case "c": {
      const compiler = language === "cpp" ? findRuntime([["g++"], ["clang++"]]) : findRuntime([["gcc"], ["clang"]]);
      if (!compiler) throw new Error(`Compiler ${language === "cpp" ? "g++" : "gcc"} tidak ditemukan di PATH.`);
      return {
        command: compiler,
        args: [sourceFile, "-o", outputFile],
        then: { command: outputFile, args: [] },
      };
    }
    case "php":
    case "ruby":
    case "sql": {
      const commandName = language === "sql" ? "sqlite3" : language;
      const command = findRuntime([[commandName]]);
      if (!command) throw new Error(`${commandName} tidak ditemukan di PATH.`);
      return language === "sql"
        ? { command, args: [":memory:", `.read ${sourceFile}`] }
        : { command, args: [sourceFile] };
    }
    case "powershell": {
      const command = findRuntime([["pwsh"], ["powershell"]]);
      if (!command) throw new Error("PowerShell tidak ditemukan di PATH.");
      return { command, args: ["-NoLogo", "-NoProfile", "-File", sourceFile] };
    }
    default:
      throw new Error("Bahasa ini belum memiliki runner.");
  }
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const safeEnvironment = {
      PATH: process.env.PATH || "",
      SYSTEMROOT: process.env.SYSTEMROOT || "",
      WINDIR: process.env.WINDIR || "",
      TEMP: process.env.TEMP || os.tmpdir(),
      TMP: process.env.TMP || os.tmpdir(),
    };
    const child = spawn(command, args, {
      cwd,
      env: safeEnvironment,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    let timedOut = false;
    const maxOutputBytes = 1024 * 1024;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 15000);

    const append = (chunk) => {
      output += chunk.toString();
      if (Buffer.byteLength(output, "utf8") > maxOutputBytes) {
        output = `${Buffer.from(output, "utf8").subarray(0, maxOutputBytes).toString("utf8")}\n\n[Output dipotong karena melebihi 1 MB.]`;
        child.kill();
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ output, exitCode: code ?? 1, timedOut });
    });
  });
}

function registerIpc() {
  ipcMain.handle("selotip:open-file", async (event) => {
    if (!isAppRenderer(event)) throw new Error("Permintaan file tidak diizinkan.");
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Buka kode",
      properties: ["openFile"],
      filters: [{ name: "Kode dan dokumen teks", extensions: ["html", "htm", "css", "js", "mjs", "py", "go", "java", "rs", "cpp", "c", "h", "php", "rb", "ps1", "sql", "json", "md", "txt", "xml", "yaml", "yml", "sh"] }],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const filePath = result.filePaths[0];
    return { canceled: false, path: filePath, content: await fs.readFile(filePath, "utf8") };
  });
  ipcMain.handle("selotip:save-file", async (event, request) => {
    if (!isAppRenderer(event)
      || !request
      || typeof request.content !== "string"
      || request.content.length > 10 * 1024 * 1024
      || (request.path !== null && request.path !== undefined && typeof request.path !== "string")) {
      throw new Error("Permintaan penyimpanan file tidak valid.");
    }
    let filePath = request.path;
    if (!filePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Simpan kode",
        defaultPath: request.suggestedName || "main.txt",
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      filePath = result.filePath;
    }
    await fs.writeFile(filePath, request.content, "utf8");
    return { canceled: false, path: filePath };
  });
  ipcMain.handle("selotip:confirm-discard", (event) => {
    if (!isAppRenderer(event)) return false;
    return dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Buang perubahan", "Batal"],
      defaultId: 1,
      cancelId: 1,
      title: "Perubahan belum disimpan",
      message: "Perubahan yang belum disimpan akan hilang.",
    }).then((result) => result.response === 0);
  });
  ipcMain.handle("selotip:run-code", async (event, language, code) => {
    if (!isAppRenderer(event)
      || typeof language !== "string"
      || !allowedLanguages.has(language)
      || typeof code !== "string"
      || code.length > 1024 * 1024) {
      throw new Error("Permintaan menjalankan kode tidak valid.");
    }
    const confirmation = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Jalankan kode tepercaya", "Batal"],
      defaultId: 1,
      cancelId: 1,
      title: "Jalankan kode di perangkat ini?",
      message: "Program akan dijalankan dengan izin akun Windows kamu.",
      detail: "Jalankan hanya kode yang kamu percaya. Kode yang tidak aman dapat mengubah atau menghapus file yang dapat diakses akunmu.",
    });
    if (confirmation.response !== 0) throw new Error("Dibatalkan.");

    const extension = {
      python: "py", javascript: "js", go: "go", java: "java", rust: "rs",
      cpp: "cpp", c: "c", php: "php", ruby: "rb", powershell: "ps1", sql: "sql",
    }[language];
    const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), `selotip-${randomUUID()}-`));
    const sourceFile = path.join(runDirectory, language === "java" ? "Main.java" : `main.${extension}`);
    const outputFile = path.join(runDirectory, process.platform === "win32" ? "program.exe" : "program");
    try {
      await fs.writeFile(sourceFile, code, "utf8");
      const plan = runtimeCommand(language, sourceFile, outputFile);
      let result = await runProcess(plan.command, plan.args, runDirectory);
      if (plan.then && !result.timedOut && result.exitCode === 0) {
        const programResult = await runProcess(plan.then.command, plan.then.args, runDirectory);
        result = {
          ...programResult,
          output: result.output + programResult.output,
          timedOut: result.timedOut || programResult.timedOut,
        };
      }
      return result;
    } finally {
      await fs.rm(runDirectory, { recursive: true, force: true });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 740,
    minHeight: 480,
    backgroundColor: "#111614",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== appUrl && !url.startsWith(`${appUrl}#`)) event.preventDefault();
  });
  void mainWindow.loadFile(indexPath).catch((error) => {
    console.error("Selotip failed to load:", error);
    dialog.showErrorBox("Selotip gagal dibuka", error.message);
    app.quit();
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
