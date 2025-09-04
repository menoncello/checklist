# AI UI Prompt: Variable Editor Modal

## High-Level Goal
Create an interactive modal dialog for editing checklist variables with type validation, real-time preview of affected commands, and support for different variable types (string, number, boolean, array, object). The modal should feel like a native terminal form with keyboard-driven interaction and immediate feedback.

## Detailed Step-by-Step Instructions

1. **Build the modal overlay system:**
   - Create a centered modal that overlays the main interface
   - Darken background with semi-transparent overlay (using ANSI dim)
   - Draw modal border with double-line box characters (╔═╗║╚╝)
   - Size modal to 80% width, max 60 columns, height based on content
   - Add drop shadow effect using darker background colors
   - Support ESC key to close, Enter to save, Ctrl+C to cancel
   - Trap focus within modal (Tab cycles through fields)

2. **Create the variable list interface:**
   - Display all variables in a scrollable table format:
     ```
     ╔═══════════════════════════════════════════════╗
     ║ Variable Name     │ Type   │ Value            ║
     ║─────────────────────────────────────────────  ║
     ║ PROJECT_NAME      │ string │ my-app           ║
     ║ ENVIRONMENT       │ select │ production ▼     ║
     ║ DEBUG_MODE        │ bool   │ [✓] enabled      ║
     ║ MAX_WORKERS       │ number │ 4                ║
     ║ ALLOWED_ORIGINS   │ array  │ [3 items] →      ║
     ║ CONFIG            │ object │ {5 props} →      ║
     ╚═══════════════════════════════════════════════╝
     ```
   - Highlight selected variable row with inverse video
   - Show variable type with appropriate icon
   - Display truncated preview for complex types
   - Use arrow keys to navigate, Enter to edit

3. **Implement type-specific editors:**
   - **String editor**: 
     - Single-line text input with cursor
     - Support backspace, delete, arrow keys
     - Show character count and max length
     - Validate against regex patterns if defined
   - **Number editor**:
     - Numeric input with increment/decrement (↑↓ or +/-)
     - Show min/max constraints if defined
     - Support decimal places configuration
     - Format with thousand separators for display
   - **Boolean editor**:
     - Toggle with Space or Enter
     - Show as checkbox: [ ] false, [✓] true
     - Display labels: "Enabled/Disabled" or custom
   - **Select/Enum editor**:
     - Dropdown list with arrow navigation
     - Show current value with ▼ indicator
     - Filter options with typing
     - Display descriptions for each option
   - **Array editor**:
     - List view with add/remove/reorder
     - [+] Add item, [-] Remove, [↑↓] Reorder
     - Edit items in place or in sub-modal
     - Show item count and type validation
   - **Object editor**:
     - Tree view with expandable properties
     - Edit leaf values inline
     - Add/remove properties
     - JSON syntax validation

4. **Add validation and constraints:**
   - Show validation rules for each variable:
     ```
     ┌─ Editing: MAX_WORKERS ────────────────┐
     │ Type: number                          │
     │ Current: 4                            │
     │                                       │
     │ New Value: [8    ]                    │
     │                                       │
     │ Constraints:                          │
     │ • Min: 1                             │
     │ • Max: 16                            │
     │ • Must be integer                    │
     │                                       │
     │ ✓ Valid                              │
     └────────────────────────────────────────┘
     ```
   - Real-time validation as user types
   - Show error messages in red
   - Disable save button if invalid
   - Support custom validation functions

5. **Create the command preview panel:**
   - Show affected commands that use edited variables:
     ```
     ┌─ Affected Commands ─────────────────────┐
     │ Commands using MAX_WORKERS:             │
     │                                         │
     │ Before:                                 │
     │ npm start --workers=4                   │
     │                                         │
     │ After:                                  │
     │ npm start --workers=8                   │
     │         ↑                              │
     │      changed                           │
     └──────────────────────────────────────────┘
     ```
   - Highlight changes with diff colors
   - Show count of affected commands
   - Preview resolution in real-time

6. **Implement bulk operations:**
   - Search/filter variables by name or value
   - Bulk edit similar variables
   - Import/export variables as JSON/YAML
   - Reset to defaults option
   - Copy variable set from another checklist
   - Environment variable import

7. **Add keyboard shortcuts and navigation:**
   - Tab/Shift+Tab: Navigate between fields
   - Enter: Edit selected variable
   - Space: Toggle boolean, expand object/array
   - /: Search variables
   - a: Add new variable
   - d: Delete variable (with confirmation)
   - r: Reset to default
   - i: Import variables
   - e: Export variables
   - Ctrl+S: Save all changes
   - ESC: Cancel without saving

## Code Examples, Data Structures & Constraints

```typescript
// Variable definition with full metadata
interface Variable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'array' | 'object';
  value: any;
  default?: any;
  description?: string;
  required: boolean;
  constraints?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    options?: Array<{
      value: any;
      label: string;
      description?: string;
    }>;
    itemType?: string;  // for arrays
    properties?: Record<string, Variable>;  // for objects
  };
  validation?: (value: any) => { valid: boolean; error?: string };
}

// Modal state management
interface ModalState {
  isOpen: boolean;
  mode: 'list' | 'edit' | 'add';
  selectedVariable?: string;
  editingValue: any;
  validationErrors: Map<string, string>;
  affectedCommands: Array<{
    before: string;
    after: string;
    diff: Array<{ type: 'same' | 'add' | 'remove'; text: string }>;
  }>;
}

// Form field renderer for different types
class FieldEditor {
  renderString(variable: Variable, value: string): string {
    const maxLength = variable.constraints?.max || 100;
    const charCount = `${value.length}/${maxLength}`;
    return `
    ┌─ ${variable.name} (string) ────────────┐
    │ ${variable.description || ''}          │
    │                                        │
    │ Value: [${value.padEnd(30)}]         │
    │        ${charCount}                   │
    └─────────────────────────────────────────┘
    `;
  }
  
  renderSelect(variable: Variable, value: any): string {
    const options = variable.constraints?.options || [];
    const selected = options.findIndex(o => o.value === value);
    
    return options.map((opt, i) => {
      const prefix = i === selected ? '▶' : ' ';
      const check = i === selected ? '●' : '○';
      return `${prefix} ${check} ${opt.label}`;
    }).join('\n');
  }
  
  renderArray(variable: Variable, value: any[]): string {
    return value.map((item, i) => {
      return `  ${i + 1}. ${JSON.stringify(item)}`;
    }).join('\n');
  }
}

// Validation helpers
const validators = {
  url: (value: string) => {
    try {
      new URL(value);
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  },
  
  email: (value: string) => {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return { valid, error: valid ? undefined : 'Invalid email format' };
  },
  
  port: (value: number) => {
    const valid = value >= 1 && value <= 65535;
    return { valid, error: valid ? undefined : 'Port must be 1-65535' };
  }
};
```

**IMPORTANT CONSTRAINTS:**
- MUST validate all input before allowing save
- MUST show real-time preview of changes
- DO NOT allow invalid data to be saved
- Support undo/redo within the editor
- Maintain variable type consistency
- Handle special characters in string values
- Escape values properly for command substitution
- Limit modal size to terminal dimensions

## Strict Scope

You should ONLY create:
- Modal overlay with variable list
- Type-specific input editors
- Validation and constraint system
- Command preview with changes
- Keyboard navigation
- Save/cancel functionality

You should NOT create:
- Actual variable persistence
- Command execution
- File system operations
- Network requests
- Template modification
- State management outside modal

## Visual Examples

**Main Variable List Modal:**
```
╔════════════════════ Variable Editor ═══════════════════════╗
║ Search: [                    ] 🔍  [a] Add  [?] Help      ║
║═════════════════════════════════════════════════════════════║
║ Name              │ Type   │ Value           │ Required   ║
║─────────────────────────────────────────────────────────────║
║ PROJECT_NAME      │ string │ my-app          │ ✓         ║
║ ENVIRONMENT       │ select │ production      │ ✓         ║
║ PORT             │ number │ 3000            │ ✓         ║
║ DEBUG_MODE       │ bool   │ false           │           ║
║ API_ENDPOINTS    │ array  │ [3 items]       │ ✓         ║
║ DATABASE_CONFIG  │ object │ {5 properties}  │ ✓         ║
║ BUILD_FLAGS      │ string │ --optimize      │           ║
║ MAX_RETRIES      │ number │ 3               │           ║
║                                                            ║
║ 8 variables total                          Page 1 of 1    ║
║═════════════════════════════════════════════════════════════║
║ [↑↓] Select  [Enter] Edit  [d] Delete  [r] Reset         ║
║ [Ctrl+S] Save All  [ESC] Cancel                          ║
╚══════════════════════════════════════════════════════════════╝
```

**String Variable Editor:**
```
╔═══════════ Editing: PROJECT_NAME ══════════╗
║ Type: String (Required)                    ║
║ Description: Name of your project          ║
║                                            ║
║ Current Value: my-app                      ║
║                                            ║
║ New Value:                                 ║
║ ┌────────────────────────────────────┐    ║
║ │ my-awesome-app▊                    │    ║
║ └────────────────────────────────────┘    ║
║ 14/50 characters                           ║
║                                            ║
║ Validation:                                ║
║ ✓ Matches pattern: ^[a-z][a-z0-9-]*$      ║
║ ✓ Length between 3-50 characters          ║
║                                            ║
║ Affected Commands: (3)                     ║
║ • docker build -t my-awesome-app:latest   ║
║ • npm init my-awesome-app                 ║
║ • kubectl create namespace my-awesome-app ║
║                                            ║
║ [Enter] Save  [ESC] Cancel                ║
╚═════════════════════════════════════════════╝
```

**Array Variable Editor:**
```
╔════════ Editing: API_ENDPOINTS ═══════╗
║ Type: Array of URLs                   ║
║                                       ║
║ Items: (3)                           ║
║ ┌───────────────────────────────┐   ║
║ │ 1. https://api.prod.com       │   ║
║ │ 2. https://api.staging.com    │   ║
║ │ 3. https://api.dev.com        │   ║
║ └───────────────────────────────┘   ║
║                                       ║
║ Actions:                             ║
║ [a] Add item                         ║
║ [e] Edit selected                    ║
║ [d] Delete selected                  ║
║ [↑↓] Move item                      ║
║                                       ║
║ Add new endpoint:                    ║
║ ┌───────────────────────────────┐   ║
║ │ https://▊                     │   ║
║ └───────────────────────────────┘   ║
║ ✓ Valid URL format                   ║
║                                       ║
║ [+] Add  [Enter] Save  [ESC] Cancel ║
╚════════════════════════════════════════╝
```

**Validation Error Display:**
```
╔═══════════ Editing: PORT ══════════════╗
║ Type: Number (Required)                ║
║                                        ║
║ Current Value: 3000                    ║
║                                        ║
║ New Value:                             ║
║ ┌──────────────┐                      ║
║ │ 99999▊       │                      ║
║ └──────────────┘                      ║
║                                        ║
║ ❌ Validation Errors:                  ║
║ • Value must be between 1-65535       ║
║ • Port 99999 is out of valid range    ║
║                                        ║
║ ⚠️  Cannot save with validation errors ║
║                                        ║
║ [ESC] Cancel                          ║
╚══════════════════════════════════════════╝
```

Remember: The variable editor is where users configure their project-specific values. Clear validation feedback, type-appropriate input methods, and immediate preview of effects are crucial for preventing configuration errors.