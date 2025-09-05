# AI UI Prompt: Command Preview Panel

## High-Level Goal

Create an interactive command preview panel that shows resolved commands with variable substitution, syntax highlighting, and safety validation. The panel should clearly indicate command type (Claude/Bash), highlight dangerous operations, and provide a safe preview before execution or copying to clipboard.

## Detailed Step-by-Step Instructions

1. **Build the command resolution engine:**
   - Parse command strings to identify variable placeholders (${VAR_NAME})
   - Substitute variables with current values from state
   - Highlight unresolved variables in red with [UNDEFINED] marker
   - Support nested variable resolution (${PREFIX_${ENV}})
   - Handle escape sequences for literal ${} usage
   - Track which variables are used in each command

2. **Implement command type detection:**
   - Automatically detect command type from content and context:
     - Bash/Shell: starts with $, contains shell keywords, has .sh extension
     - Claude AI: contains natural language instructions, AI-specific patterns
     - SQL: contains SQL keywords (SELECT, INSERT, UPDATE, DELETE)
     - Docker: starts with docker/docker-compose commands
     - Kubernetes: kubectl commands or YAML manifests
   - Allow manual override of detected type
   - Display type badge with appropriate icon and color:
     - [Claude] with 🤖 icon in cyan
     - [Bash] with $ icon in green
     - [SQL] with 🗃 icon in blue
     - [Docker] with 🐳 icon in blue
     - [K8s] with ☸ icon in purple

3. **Create danger level analysis:**
   - Scan commands for dangerous patterns:
     - Destructive: rm -rf, DROP TABLE, DELETE FROM, :w!, format
     - Sudo operations: sudo, su, chown, chmod 777
     - Network exposure: 0.0.0.0, EXPOSE, --publish
     - Credential risks: password=, token=, secret=, private key
   - Assign danger levels:
     - 🟢 Safe: read-only operations, queries
     - 🟡 Caution: modifies local files, restartable services
     - 🔴 Dangerous: destructive, irreversible, affects production
   - Show danger indicator with explanation tooltip

4. **Build the preview layout:**
   - Create bordered box with command type header
   - Display original command with variables highlighted
   - Show resolved command below with substitutions applied
   - Add execution context sidebar:
     ```
     Working Directory: /home/user/project
     Shell: /bin/bash
     User: john.doe
     Time Estimate: ~30s
     ```
   - Include affected resources list:
     ```
     Affected Resources:
     ├─ Files: 3 modified, 0 deleted
     ├─ Services: nginx (restart)
     └─ Network: port 8080 exposed
     ```

5. **Implement syntax highlighting:**
   - Apply language-specific highlighting:
     - Bash: commands blue, arguments white, flags yellow, strings green
     - SQL: keywords uppercase blue, tables green, values yellow
     - YAML: keys cyan, values white, comments gray
     - JSON: keys blue, strings green, numbers yellow, booleans magenta
   - Highlight variables differently in resolved vs unresolved state
   - Show line numbers for multi-line commands
   - Add diff highlighting for before/after variable substitution

6. **Add interactive preview features:**
   - Toggle between compact/expanded view with Tab
   - Show/hide resolved variables with 'v'
   - Simulate execution with 's' (dry-run mode)
   - Edit command inline with 'e'
   - Copy original with 'o', resolved with 'r'
   - Show execution history with 'h'
   - Add to favorites with 'f'

7. **Create the simulation mode:**
   - Show expected output preview (when possible)
   - Display estimated execution time
   - List files that would be created/modified/deleted
   - Show network connections that would be opened
   - Preview environment variable changes
   - Indicate if command requires user input

## Code Examples, Data Structures & Constraints

```typescript
// Command structure with full metadata
interface CommandPreview {
  original: string;
  resolved: string;
  type: 'claude' | 'bash' | 'sql' | 'docker' | 'kubernetes';
  danger: {
    level: 'safe' | 'caution' | 'dangerous';
    reasons: string[];
    affects: {
      files?: string[];
      services?: string[];
      network?: string[];
      data?: string[];
    };
  };
  variables: Map<
    string,
    {
      value: string | undefined;
      source: 'env' | 'state' | 'user' | 'default';
      required: boolean;
    }
  >;
  context: {
    workDir: string;
    shell: string;
    user: string;
    estimatedTime?: string;
  };
}

// Danger patterns to detect
const dangerPatterns = {
  destructive: [
    /rm\s+-rf?\s+\//, // rm -rf on root paths
    /DROP\s+(TABLE|DATABASE)/i,
    /DELETE\s+FROM/i,
    /truncate/i,
    /format\s+\/dev/,
  ],
  sudo: [/^sudo\s+/, /\bsu\s+-/, /chmod\s+777/, /chown\s+root/],
  credential: [
    /password\s*=\s*["']?[^"'\s]+/i,
    /api[_-]?key\s*=\s*["']?[^"'\s]+/i,
    /secret\s*=\s*["']?[^"'\s]+/i,
    /private[_-]?key/i,
  ],
  network: [/0\.0\.0\.0/, /--publish\s+\d+:\d+/, /EXPOSE\s+\d+/, /-p\s+\d+:\d+/],
};

// Syntax highlighting for different languages
const syntaxHighlight = {
  bash: (text: string) => {
    return text
      .replace(/\$\w+/g, (match) => `${ansi.yellow}${match}${ansi.reset}`)
      .replace(/--?\w+/g, (match) => `${ansi.cyan}${match}${ansi.reset}`)
      .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => `${ansi.green}${match}${ansi.reset}`)
      .replace(/^\s*#.*/gm, (match) => `${ansi.gray}${match}${ansi.reset}`);
  },
  sql: (text: string) => {
    const keywords = /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|ON|AND|OR)\b/gi;
    return text.replace(keywords, (match) => `${ansi.blue}${match.toUpperCase()}${ansi.reset}`);
  },
};

// Variable resolution with fallback
function resolveVariables(
  command: string,
  variables: Record<string, any>
): { resolved: string; missing: string[] } {
  const missing: string[] = [];
  const resolved = command.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    if (varName in variables) {
      return variables[varName];
    } else {
      missing.push(varName);
      return `${ansi.red}[UNDEFINED:${varName}]${ansi.reset}`;
    }
  });
  return { resolved, missing };
}
```

**IMPORTANT CONSTRAINTS:**

- MUST validate all commands before allowing copy/execute
- MUST clearly indicate danger level with explanations
- DO NOT execute commands directly - preview only
- DO NOT expose sensitive information in previews
- MUST handle malformed commands gracefully
- Support undo/redo for command edits
- Cache resolution results for performance
- Limit preview simulation to safe operations only

## Strict Scope

You should ONLY create:

- Command preview and resolution display
- Variable substitution visualization
- Danger level analysis and warnings
- Syntax highlighting for commands
- Interactive preview controls
- Simulation/dry-run display

You should NOT create:

- Actual command execution
- File system modifications
- Network requests
- Database connections
- Process spawning
- Real system changes

## Visual Examples

**Safe Command Preview:**

```
┌─ Command Preview ──────────────────────────────────────────┐
│ Type: [Bash] $ │ Status: 🟢 Safe │ Time: ~2s              │
├─────────────────────────────────────────────────────────────┤
│ Original Command:                                           │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ npm run build --mode=${BUILD_MODE}                  │   │
│ │         ↑                ↑                           │   │
│ │      command         variable                       │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                              │
│ Resolved Command:                                           │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ npm run build --mode=production                     │   │
│ │                      ↑                               │   │
│ │                  resolved                            │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                              │
│ Variables:                                                  │
│ ├─ ${BUILD_MODE} = "production" (from: state)              │
│ └─ All variables resolved ✓                                │
│                                                              │
│ Context:                                                     │
│ ├─ Directory: /home/user/my-app                            │
│ ├─ Creates: dist/, build/                                  │
│ └─ Modifies: package-lock.json                             │
└─────────────────────────────────────────────────────────────┘
 [c] Copy resolved  [o] Copy original  [e] Edit  [s] Simulate
```

**Dangerous Command Preview:**

```
┌─ Command Preview ──────────────────────────────────────────┐
│ Type: [Bash] $ │ Status: 🔴 DANGEROUS │ Time: instant     │
├─────────────────────────────────────────────────────────────┤
│ ⚠️  WARNING: This command is potentially destructive!       │
│                                                              │
│ Original Command:                                           │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ rm -rf ${TARGET_DIR}/*                              │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                              │
│ Resolved Command:                                           │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ rm -rf /var/www/html/*                              │   │
│ │        ↑                                             │   │
│ │    DANGER: Deletes all files!                       │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                              │
│ ⚠️  Danger Analysis:                                        │
│ ├─ Destructive operation (rm -rf)                          │
│ ├─ Affects system directory (/var/www/html)                │
│ ├─ No recovery possible after execution                    │
│ └─ Will delete approximately 1,247 files                   │
│                                                              │
│ Affected Resources:                                         │
│ ├─ Files: 1,247 to be deleted                              │
│ ├─ Size: ~450MB of data                                    │
│ └─ Services: May break web server                          │
│                                                              │
│ 🔴 Type "CONFIRM" to enable copy/execute buttons           │
└─────────────────────────────────────────────────────────────┘
 [!] Too dangerous to copy without confirmation
```

**Claude AI Command Preview:**

```
┌─ Command Preview ──────────────────────────────────────────┐
│ Type: [Claude] 🤖 │ Status: 🟢 Safe │ Tokens: ~150       │
├─────────────────────────────────────────────────────────────┤
│ Original Prompt:                                            │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Review the ${LANGUAGE} code in ${FILE_PATH} and     │   │
│ │ suggest performance improvements. Focus on          │   │
│ │ ${FOCUS_AREA} optimizations.                        │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                              │
│ Resolved Prompt:                                           │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Review the TypeScript code in src/utils/parser.ts   │   │
│ │ and suggest performance improvements. Focus on      │   │
│ │ memory usage optimizations.                         │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                              │
│ Variables:                                                  │
│ ├─ ${LANGUAGE} = "TypeScript" ✓                            │
│ ├─ ${FILE_PATH} = "src/utils/parser.ts" ✓                 │
│ └─ ${FOCUS_AREA} = "memory usage" ✓                       │
│                                                              │
│ Claude Context:                                             │
│ ├─ Estimated tokens: ~150                                  │
│ ├─ Response type: Code review                              │
│ └─ No file access required                                 │
└─────────────────────────────────────────────────────────────┘
 [c] Copy to Claude  [e] Edit prompt  [v] Edit variables
```

Remember: The command preview panel is the last safety check before potentially destructive operations. Clear danger indicators, resolved variable display, and simulation capabilities are essential for preventing costly mistakes.
