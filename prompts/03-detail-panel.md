# AI UI Prompt: Detail Panel with Markdown Support

## High-Level Goal

Create a rich detail panel that renders markdown-formatted checklist item descriptions in the terminal, with proper formatting for code blocks, emphasis, lists, and special command indicators. The panel should clearly differentiate between Claude AI commands and terminal commands while supporting variable substitution previews.

## Detailed Step-by-Step Instructions

1. **Build the markdown parser for terminal output:**
   - Parse markdown text and convert to ANSI-formatted terminal output
   - Support headers (#, ##, ###) with bold and increased brightness
   - Render **bold** text using ANSI bold codes (\x1b[1m)
   - Render _italic_ text using ANSI italic codes (\x1b[3m) with fallback to underline
   - Display `inline code` with gray background and monospace preservation
   - Parse and format code blocks with syntax highlighting
   - Handle bullet lists (-, \*, +) and numbered lists with proper indentation
   - Support blockquotes (>) with left border and indentation

2. **Implement code block rendering with syntax highlighting:**
   - Detect language from code fence markers (`javascript, `bash, etc.)
   - Apply syntax highlighting using ANSI colors:
     - Keywords in cyan
     - Strings in green
     - Comments in gray
     - Numbers in yellow
     - Functions in blue
   - Preserve indentation and formatting exactly
   - Add line numbers for blocks >5 lines
   - Show language indicator in top-right of block

3. **Create command differentiation system:**
   - Detect and specially format Claude AI commands:
     - Prefix with "[Claude]" badge in cyan background
     - Add distinctive left border using "▌" character in cyan
     - Show "Copy to Claude" hint at bottom
   - Format Bash/terminal commands:
     - Prefix with "[$]" badge in green background
     - Add distinctive left border using "▌" character in green
     - Show "Copy to Terminal" hint at bottom
   - Highlight dangerous commands (rm -rf, DROP, etc.) in red with warning icon

4. **Add variable substitution preview:**
   - Detect ${variable} patterns in text and commands
   - Highlight variables in yellow/amber color
   - Show current variable values in a subtle box:
     ```
     Variables:
     ├─ ${PROJECT_NAME} = "my-app"
     ├─ ${ENV} = "production"
     └─ ${VERSION} = "1.2.3"
     ```
   - Update preview in real-time as variables change
   - Show [undefined] for missing variables in red

5. **Implement scrollable content area:**
   - Enable vertical scrolling for long descriptions
   - Show scroll position indicator on right edge
   - Support keyboard scrolling:
     - e/Ctrl+e: Scroll down one line
     - y/Ctrl+y: Scroll up one line
     - f/Ctrl+f: Page down
     - b/Ctrl+b: Page up
   - Maintain scroll position when switching between items
   - Auto-scroll to top when selecting new item

6. **Create the panel layout structure:**
   - Display item title at top in large, bold text
   - Show item metadata bar: status, duration, last updated
   - Render main description content with word wrapping
   - Add separator line before command section
   - Display commands in clearly defined boxes
   - Show action hints at bottom: available keyboard shortcuts

7. **Add visual enhancements and formatting:**
   - Use box drawing characters for command blocks and sections
   - Apply subtle gradients using ANSI 256-color mode for backgrounds
   - Add icons for different content types:
     - 📝 for notes
     - ⚠️ for warnings
     - ℹ️ for info
     - ✅ for success messages
     - ❌ for error messages
   - Implement smart word wrapping that respects terminal width
   - Preserve intentional line breaks and spacing

## Code Examples, Data Structures & Constraints

```typescript
// Markdown AST node types
interface MarkdownNode {
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'emphasis' | 'strong' | 'blockquote';
  content: string | MarkdownNode[];
  metadata?: {
    level?: number; // For headings
    language?: string; // For code blocks
    ordered?: boolean; // For lists
  };
}

// Command detection and formatting
interface Command {
  type: 'claude' | 'bash' | 'unknown';
  text: string;
  variables: Array<{
    name: string;
    value: string | undefined;
    position: { start: number; end: number };
  }>;
  danger_level: 'safe' | 'warning' | 'dangerous';
}

// ANSI formatting utilities
const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',

  // Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Backgrounds
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
  bgGray: '\x1b[100m',
};

// Word wrapping algorithm
function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length > width) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines;
}

// Syntax highlighting patterns
const syntaxPatterns = {
  javascript: {
    keywords: /\b(const|let|var|function|return|if|else|for|while)\b/g,
    strings: /(["'`])(?:(?=(\\?))\2.)*?\1/g,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
    numbers: /\b\d+\.?\d*\b/g,
  },
  bash: {
    keywords: /\b(if|then|else|fi|for|while|do|done|function)\b/g,
    strings: /(["'])(?:(?=(\\?))\2.)*?\1/g,
    comments: /#.*$/gm,
    variables: /\$\{?[\w]+\}?/g,
  },
};
```

**IMPORTANT CONSTRAINTS:**

- MUST preserve exact formatting of code blocks and commands
- MUST handle ANSI codes properly without breaking terminal display
- DO NOT exceed terminal width - implement proper word wrapping
- DO NOT use HTML or web rendering - pure terminal output only
- MUST escape special characters that could break terminal display
- Support fallback rendering for terminals without full ANSI support
- Cache parsed markdown to avoid re-parsing unchanged content
- Limit syntax highlighting complexity to maintain performance

## Strict Scope

You should ONLY create:

- Markdown to ANSI parser and renderer
- Code block syntax highlighting
- Command differentiation display
- Variable substitution preview
- Scrollable content area
- Panel layout and formatting

You should NOT create:

- External markdown editor
- File system operations
- Command execution logic
- Network requests
- State management
- Interactive forms

## Content Examples and Rendering

**Input Markdown:**

````markdown
# Deploy to Production

This step will deploy your application to the **production** environment.

## Prerequisites

- All tests must pass
- Code review approved
- Staging deployment successful

## Commands

First, build the Docker image:

```bash
docker build -t ${APP_NAME}:${VERSION} .
docker tag ${APP_NAME}:${VERSION} ${REGISTRY}/${APP_NAME}:${VERSION}
```
````

Then deploy using kubectl:

```claude
Generate a Kubernetes deployment manifest for ${APP_NAME} with:
- Image: ${REGISTRY}/${APP_NAME}:${VERSION}
- Replicas: 3
- Health checks configured
- Resource limits: 2CPU, 4GB RAM
```

> **Warning**: This will affect live users. Ensure you have a rollback plan.

```

**Terminal Rendering:**
```

╭─────────────────────────────────────────────────────────╮
│ Deploy to Production │
│ ═══════════════════ │
│ │
│ This step will deploy your application to the │
│ production environment. │
│ │
│ Prerequisites │
│ ───────────── │
│ • All tests must pass │
│ • Code review approved │
│ • Staging deployment successful │
│ │
│ Commands │
│ ──────── │
│ First, build the Docker image: │
│ │
│ ┌─ [Terminal Command] ─────────────────────────────┐ │
│ │ $ docker build -t my-app:1.2.3 . │ │
│ │ $ docker tag my-app:1.2.3 \ │ │
│ │ registry.io/my-app:1.2.3 │ │
│ └────────────────────────────── Copy to Terminal ──┘ │
│ │
│ Then deploy using kubectl: │
│ │
│ ┌─ [Claude AI Command] ────────────────────────────┐ │
│ │ Generate a Kubernetes deployment manifest for │ │
│ │ my-app with: │ │
│ │ - Image: registry.io/my-app:1.2.3 │ │
│ │ - Replicas: 3 │ │
│ │ - Health checks configured │ │
│ │ - Resource limits: 2CPU, 4GB RAM │ │
│ └──────────────────────────── Copy to Claude ──────┘ │
│ │
│ ⚠️ Warning: This will affect live users. Ensure you │
│ have a rollback plan. │
│ │
│ ┌─ Variables ──────────────────────────────────────┐ │
│ │ ${APP_NAME} = "my-app" │ │
│ │ ${VERSION} = "1.2.3" │ │
│ │ ${REGISTRY} = "registry.io" │ │
│ └───────────────────────────────────────────────────┘ │
╰─────────────────────────────────────────────────────────╯
[c] Copy command [e] Edit variables [↑↓] Scroll [Tab] Back

```

## Responsive Width Handling

**Narrow (60 cols):**
- Reduce padding and margins
- Wrap text more aggressively
- Hide decorative elements
- Show abbreviated variable names

**Standard (80 cols):**
- Standard padding
- Full variable names
- Basic syntax highlighting
- Single column layout

**Wide (120+ cols):**
- Generous padding
- Full syntax highlighting
- Side-by-side command comparison
- Extended metadata display

Remember: The detail panel is where users spend most time reading and understanding tasks. Clear formatting, proper command differentiation, and variable visibility are critical for preventing errors and maintaining flow.
```
