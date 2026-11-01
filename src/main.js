import { basicSetup, EditorView } from "codemirror";
import { languages } from "@codemirror/language-data";
import { Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import "./style.css";

const $ = (selector) => document.querySelector(selector);
const languageCompartment = new Compartment();
const editorTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "#111614", color: "#e5ebe6" },
  ".cm-content": { caretColor: "#b7eb9f" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-activeLineGutter": { backgroundColor: "#1b231e" },
}, { dark: true });
const examples = {
  html: { file: "index.html", code: "<!doctype html>\n<html lang=\"id\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>Pratinjau Selotip</title>\n</head>\n<body>\n  <main>\n    <h1>Halo dari Selotip!</h1>\n    <p>Tulis HTML, CSS, atau JavaScript, lalu tekan Preview.</p>\n    <button id=\"hello\">Coba tombol</button>\n  </main>\n  <script>\n    document.querySelector('#hello').addEventListener('click', () => {\n      document.querySelector('p').textContent = 'Tombolnya berfungsi!';\n    });\n  </script>\n</body>\n</html>" },
  javascript: { file: "app.js", code: "console.log('Halo dari Selotip!');\nconsole.log('Tekan Preview untuk menjalankan JavaScript.');" },
  python: { file: "main.py", code: "print('Halo dari Selotip!')\nprint('Python berjalan di runtime yang sudah terpasang.')" },
  css: { file: "style.css", code: "body {\n  font-family: system-ui, sans-serif;\n  padding: 2rem;\n}\n\nh1 {\n  color: #426b50;\n}" },
  json: { file: "data.json", code: "{\n  \"app\": \"Selotip\",\n  \"bahasa\": [\"Python\", \"JavaScript\", \"Go\"]\n}" },
  go: { file: "main.go", code: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Halo dari Selotip!\")\n}" },
  java: { file: "Main.java", code: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Halo dari Selotip!\");\n    }\n}" },
  rust: { file: "main.rs", code: "fn main() {\n    println!(\"Halo dari Selotip!\");\n}" },
  cpp: { file: "main.cpp", code: "#include <iostream>\n\nint main() {\n    std::cout << \"Halo dari Selotip!\" << std::endl;\n    return 0;\n}" },
  c: { file: "main.c", code: "#include <stdio.h>\n\nint main(void) {\n    puts(\"Halo dari Selotip!\");\n    return 0;\n}" },
  php: { file: "index.php", code: "<?php\necho \"Halo dari Selotip!\\n\";\n" },
  ruby: { file: "main.rb", code: "puts \"Halo dari Selotip!\"\n" },
  powershell: { file: "main.ps1", code: "Write-Output 'Halo dari Selotip!'\n" },
  sql: { file: "query.sql", code: "SELECT 'Halo dari Selotip!' AS pesan;\n" },
  markdown: { file: "README.md", code: "# Halo dari Selotip!\n\nTulis kode dalam bahasa pilihanmu, lalu tekan **Preview**.\n" },
};

const languageOptions = [
  ["html", "HTML"],
  ["css", "CSS"],
  ["javascript", "JavaScript"],
  ["python", "Python"],
  ["go", "Go"],
  ["java", "Java"],
  ["rust", "Rust"],
  ["cpp", "C++"],
  ["c", "C"],
  ["php", "PHP"],
  ["ruby", "Ruby"],
  ["powershell", "PowerShell"],
  ["sql", "SQL"],
  ["json", "JSON"],
  ["markdown", "Markdown"],
];
let currentLanguage = "html";
let currentFilePath = null;
let dirty = false;
let runPending = false;

const languageSelect = $("#languageSelect");
for (const [id, label] of languageOptions) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = label;
  languageSelect.append(option);
}

const editor = new EditorView({
  parent: $("#editor"),
  extensions: [
    basicSetup,
    editorTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) setDirty(true);
      if (update.selectionSet) updateCursor();
    }),
    keymap.of([{ key: "Mod-Enter", run: () => { void runPreview(); return true; } }]),
    languageCompartment.of([]),
  ],
  doc: examples.html.code,
});

function setStatus(message) {
  $("#statusMessage").textContent = message;
}

function setDirty(value) {
  dirty = value;
  $("#unsavedMark").hidden = !value;
  $("#saveState").textContent = value ? "Perubahan belum disimpan" : currentFilePath ? "Tersimpan" : "Belum disimpan";
}

function updateCursor() {
  const position = editor.state.selection.main.head;
  const line = editor.state.doc.lineAt(position);
  $("#cursorPosition").textContent = `BARIS ${line.number}, KOLOM ${position - line.from + 1}`;
}

async function setLanguage(language) {
  currentLanguage = language;
  languageSelect.value = language;
  const file = examples[language] || { file: `main.${language}`, code: "" };
  const extension = file.file.split(".").pop();
  const description = languages.find((item) => item.alias.some((alias) => alias.toLowerCase() === language)
    || item.extensions.includes(extension));
  const support = await description?.load();
  editor.dispatch({ effects: languageCompartment.reconfigure(support || []) });
  $("#fileDot").style.background = language === "html" ? "#dfaa63" : "#8da77f";
  $("#languageHint").textContent = ["html", "css", "javascript"].includes(language)
    ? `${language.toUpperCase()} · live preview`
    : `${languageOptions.find(([id]) => id === language)?.[1] || language} · runtime lokal`;
  $("#statusLanguage").textContent = language.toUpperCase();
}

function showWebPreview(documentHtml) {
  $("#runtimeOutput").hidden = true;
  $("#runtimeOutput").textContent = "";
  $("#runtimeOutput").classList.remove("error");
  $("#previewFrame").hidden = false;
  $("#previewFrame").srcdoc = documentHtml;
  $("#emptyPreview").hidden = true;
  $("#previewTitle").textContent = "PRATINJAU WEB";
  $("#runtimeLabel").textContent = "IFRAME TERISOLASI";
}

function wrapCode(language, code) {
  if (language === "html") return code;
  if (language === "css") {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${code}</style></head><body><main><h1>Pratinjau CSS</h1><p>Style aktif ditampilkan pada halaman ini.</p><button>Contoh tombol</button></main></body></html>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'"><style>body{font:15px system-ui,sans-serif;padding:24px;color:#27342a}pre{padding:14px;border-radius:8px;background:#f1f5f0;color:#304735;white-space:pre-wrap}</style></head><body><h2>JavaScript · output</h2><pre id="output"></pre><script>const output=document.querySelector('#output');console.log=(...values)=>{output.textContent += values.map(value=>typeof value==='object'?JSON.stringify(value):String(value)).join(' ')+'\\n'};console.error=(...values)=>{output.textContent += 'ERROR: '+values.map(String).join(' ')+'\\n'};window.onerror=(_message,_source,line,_column,error)=>{console.error(error?.stack||_message, 'baris', line)};</script><script>${code.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}

async function runPreview() {
  if (runPending) return;
  const code = editor.state.doc.toString();
  $("#previewButton").disabled = true;
  runPending = true;
  if (["html", "css", "javascript"].includes(currentLanguage)) {
    showWebPreview(wrapCode(currentLanguage, code));
    setStatus("Pratinjau diperbarui");
    $("#previewButton").disabled = false;
    runPending = false;
    return;
  }

  $("#previewFrame").hidden = true;
  $("#runtimeOutput").hidden = false;
  $("#runtimeOutput").classList.remove("error");
  $("#runtimeOutput").textContent = "Menjalankan dengan runtime lokal…";
  $("#emptyPreview").hidden = true;
  $("#previewTitle").textContent = "OUTPUT PROGRAM";
  $("#runtimeLabel").textContent = "RUNTIME LOKAL";
  try {
    const result = await window.selotip.runCode(currentLanguage, code);
    $("#runtimeOutput").textContent = result.output || "(Selesai tanpa output.)";
    $("#runtimeOutput").classList.toggle("error", result.exitCode !== 0 || result.timedOut);
    setStatus(result.timedOut ? "Runtime dihentikan setelah 15 detik" : `Program selesai · kode ${result.exitCode}`);
  } catch (error) {
    $("#runtimeOutput").textContent = error.message;
    $("#runtimeOutput").classList.add("error");
    setStatus("Runtime gagal");
  } finally {
    $("#previewButton").disabled = false;
    runPending = false;
  }
}

async function openFile() {
  try {
    const result = await window.selotip.openFile();
    if (result.canceled) return;
    const extension = result.path.split(".").pop().toLowerCase();
    const match = languageOptions.find(([id]) => examples[id]?.file.split(".").pop() === extension);
    currentFilePath = result.path;
    $("#fileName").textContent = result.path.split(/[\\/]/).pop();
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: result.content } });
    if (match) await setLanguage(match[0]);
    setDirty(false);
    setStatus(`Dibuka: ${result.path}`);
  } catch (error) {
    setStatus(`Tidak dapat membuka file: ${error.message}`);
  }
}

async function saveFile() {
  try {
    const result = await window.selotip.saveFile({
      path: currentFilePath,
      content: editor.state.doc.toString(),
      suggestedName: examples[currentLanguage]?.file || "main.txt",
    });
    if (result.canceled) return;
    currentFilePath = result.path;
    $("#fileName").textContent = result.path.split(/[\\/]/).pop();
    setDirty(false);
    setStatus(`Disimpan: ${result.path}`);
  } catch (error) {
    setStatus(`Tidak dapat menyimpan file: ${error.message}`);
  }
}

async function newFile() {
  if (dirty && !await window.selotip.confirmDiscard()) return;
  currentFilePath = null;
  $("#fileName").textContent = examples[currentLanguage].file;
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: examples[currentLanguage].code } });
  setDirty(false);
  setStatus("File baru");
}

languageSelect.addEventListener("change", async () => {
  if (dirty && !await window.selotip.confirmDiscard()) {
    languageSelect.value = currentLanguage;
    return;
  }
  currentFilePath = null;
  const nextLanguage = languageSelect.value;
  $("#fileName").textContent = examples[nextLanguage]?.file || `main.${nextLanguage}`;
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: examples[nextLanguage]?.code || "" },
  });
  await setLanguage(nextLanguage);
  setDirty(false);
});

$("#newButton").addEventListener("click", () => void newFile());
$("#openButton").addEventListener("click", () => void openFile());
$("#saveButton").addEventListener("click", () => void saveFile());
$("#previewButton").addEventListener("click", () => void runPreview());
$("#clearOutput").addEventListener("click", () => {
  $("#runtimeOutput").textContent = "";
  $("#previewFrame").srcdoc = "";
  $("#emptyPreview").hidden = false;
  $("#runtimeOutput").hidden = true;
  $("#previewFrame").hidden = true;
  setStatus("Output dibersihkan");
});
window.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    void saveFile();
  } else if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    void openFile();
  }
});

void setLanguage(currentLanguage);
updateCursor();
