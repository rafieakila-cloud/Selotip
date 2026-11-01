# Selotip

Selotip is a lightweight desktop code editor with syntax highlighting, file open/save, a sandboxed HTML/CSS/JavaScript preview, and an optional runner for programming-language runtimes already installed on the computer.

## Features

- Edit HTML, CSS, JavaScript, Python, Go, Java, Rust, C, C++, PHP, Ruby, PowerShell, SQL, JSON, and Markdown.
- Highlight syntax for supported languages with CodeMirror.
- Preview HTML, CSS, and JavaScript locally in an isolated iframe without network access.
- Run Python, JavaScript, Go, Java, Rust, C/C++, PHP, Ruby, PowerShell, and SQLite when the matching local runtime is installed.
- Confirm each local program run; execution uses the current Windows account's permissions and should be limited to trusted code.
- Open and save source files with native file dialogs.

## Download for Windows

Download the latest `Selotip-*-Windows-x64.exe` installer from the repository's [Releases](../../releases) page.

## Build on Windows

Requirements: Node.js and npm.

```powershell
npm ci
npm run desktop
```

Create the Windows installer:

```powershell
npm run desktop:dist
```

The setup executable is generated in `release/`.

## Runtime support

Selotip is an editor, not a compiler. Previewing HTML/CSS/JavaScript is built in. Other languages need their corresponding runtime/compiler installed and available in `PATH`. Python 3 can also be found through the Windows `py -3` launcher. Unsupported languages can still be edited and saved.

The local runner uses a 15-second timeout and caps displayed output at 1 MB. It is not a security sandbox; do not run source code you do not trust.

## Project credits

Rafie Akila Cloud and Bawapi.
