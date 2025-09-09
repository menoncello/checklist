# External APIs (Updated with Bun)

## Bun Package Registry API

- **Purpose:** Distribute tool via Bun's package management
- **Documentation:** Bun package management
- **Base URL(s):** Uses npm registry but through Bun's optimized client
- **Authentication:** None for public packages
- **Rate Limits:** Bun's internal optimizations handle this

**Key Commands Used:**

- `bunx @bmad/checklist` - Run without installation
- `bun add -g @bmad/checklist` - Global installation
- `bun pm cache` - Manage package cache
- `bun pm ls` - List installed packages

## Environment Detection API (Bun Native)

- **Purpose:** Detect development environment context using Bun's native APIs
- **Documentation:** Bun.env and Bun runtime APIs
- **Base URL(s):** Bun runtime environment
- **Authentication:** None
- **Rate Limits:** None

**Key APIs Used:**

- `Bun.env` - Environment variables (faster than process.env)
- `Bun.version` - Bun version detection
- `Bun.which()` - Detect available commands
- `Bun.main` - Detect if running as main module
- `Bun.isWindows`, `Bun.isMacOS`, `Bun.isLinux` - OS detection

## System Notification API

- **Purpose:** Display native OS notifications for important events
- **Documentation:** OS-specific notification systems
- **Base URL(s):** System notification service
- **Authentication:** User-level permissions
- **Rate Limits:** OS-dependent throttling

**Key Endpoints Used:**

- `osascript -e 'display notification'` (macOS) - Native notifications
- `notify-send` (Linux) - Desktop notifications
- `powershell -Command "New-BurntToastNotification"` (Windows) - Toast notifications
- Terminal bell (`\x07`) - Fallback audio alert

## GitHub Releases API

- **Purpose:** Check for new versions and display update notifications
- **Documentation:** https://docs.github.com/en/rest/releases
- **Base URL(s):** https://api.github.com/repos/owner/bmad-checklist
- **Authentication:** None (public repo)
- **Rate Limits:** 60 requests per hour unauthenticated
