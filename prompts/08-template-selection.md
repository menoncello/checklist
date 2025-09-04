# AI UI Prompt: Template Selection Screen

## High-Level Goal
Create an intuitive template selection interface that allows users to browse, preview, and initialize checklists from templates. The screen should feel like a package manager UI (npm, brew) with categories, search, previews, and clear metadata about each template's purpose and requirements.

## Detailed Step-by-Step Instructions

1. **Build the template gallery layout:**
   - Create a grid/list hybrid view with templates as cards:
     ```
     ╔══════════════════ Checklist Templates ═══════════════════╗
     ║ Categories: [All] [Dev] [Deploy] [Testing] [Custom]      ║
     ║ Search: [                              ] 🔍  15 templates║
     ╠═══════════════════════════════════════════════════════════╣
     ║ ┌─────────────────────────────────────────────────┐     ║
     ║ │ 📦 Node.js API Setup            ⭐ 4.8  👥 1.2k │     ║
     ║ │ Complete setup for Express.js REST API          │     ║
     ║ │ 23 steps • ~45 min • Requires: Node 18+        │     ║
     ║ └─────────────────────────────────────────────────┘     ║
     ```
   - Show template icon/emoji for visual recognition
   - Display ratings and usage count
   - Include estimated completion time
   - Show requirement badges

2. **Implement the category navigation:**
   - Create category tabs with counts:
     ```
     Categories:
     ┌─────┬──────────┬──────────┬─────────┬────────┐
     │ All │ Dev (8)  │ Deploy(4)│ Test(3) │ Mine(2)│
     │ 17  │          │          │         │        │
     └─────┴──────────┴──────────┴─────────┴────────┘
     ```
   - Support keyboard navigation: Tab between categories
   - Show subcategories when applicable
   - Highlight active category
   - Remember last selected category

3. **Create the template preview panel:**
   - Show detailed preview when template selected:
     ```
     ╔════════ Template Preview: Node.js API Setup ════════╗
     ║ Description:                                        ║
     ║ Complete checklist for setting up a production-     ║
     ║ ready Node.js API with Express, including testing,  ║
     ║ documentation, and deployment configuration.        ║
     ║                                                      ║
     ║ Sections:                                           ║
     ║ ├─ 📁 Project Setup (5 steps)                      ║
     ║ ├─ 🔧 Configuration (4 steps)                      ║
     ║ ├─ 💻 Development (8 steps)                        ║
     ║ ├─ 🧪 Testing (3 steps)                            ║
     ║ └─ 🚀 Deployment (3 steps)                         ║
     ║                                                      ║
     ║ Required Variables:                                 ║
     ║ • PROJECT_NAME - Your project name                 ║
     ║ • NODE_VERSION - Node.js version (default: 18)    ║
     ║ • DATABASE - Database type (postgres/mongo)       ║
     ║                                                      ║
     ║ Author: @john_doe │ Updated: 2 days ago           ║
     ║ License: MIT │ Downloads: 1,247                    ║
     ╚══════════════════════════════════════════════════════╝
     ```

4. **Add the search and filter system:**
   - Implement real-time search with highlighting:
     ```
     Search: [docker     ] 🔍
     
     Results (3):
     • Docker Container Setup - Full containerization
       └─ Matches: title, tags: docker, container
     • Kubernetes Deployment - K8s with Docker images
       └─ Matches: step 3: "Build Docker image"
     • Microservices Template - Docker-based services
       └─ Matches: requirements: Docker 20+
     ```
   - Support filters:
     - By difficulty: Beginner, Intermediate, Advanced
     - By duration: <30min, 30-60min, >1hr
     - By popularity: Most used, Trending, New
     - By source: Official, Community, Personal
   - Show match context in results

5. **Create the template initialization wizard:**
   - Multi-step initialization flow:
     ```
     ╔═══════ Initialize from Template (Step 1/3) ═══════╗
     ║ Template: Node.js API Setup                       ║
     ║                                                    ║
     ║ 1. Set Required Variables                         ║
     ║ ──────────────────────────                        ║
     ║ PROJECT_NAME:                                     ║
     ║ [my-awesome-api              ]                    ║
     ║ ✓ Valid project name                             ║
     ║                                                    ║
     ║ NODE_VERSION:                                      ║
     ║ ○ 16 (LTS)                                        ║
     ║ ● 18 (LTS, Recommended)                          ║
     ║ ○ 20 (Current)                                    ║
     ║                                                    ║
     ║ DATABASE:                                          ║
     ║ ○ PostgreSQL                                      ║
     ║ ● MongoDB                                          ║
     ║ ○ MySQL                                            ║
     ║ ○ None (In-memory)                                ║
     ║                                                    ║
     ║ [Next →] [Cancel]                                 ║
     ╚═════════════════════════════════════════════════════╝
     ```
   - Validate inputs before proceeding
   - Show progress indicator
   - Allow back navigation
   - Preview final configuration

6. **Implement template management features:**
   - Favorite templates with star icon
   - Recent templates section
   - Template version selection
   - Fork/customize template option
   - Share template via link/export
   - Rate and review templates
   - Report issues with templates

7. **Add template source indicators:**
   - Show template source with badges:
     ```
     Sources:
     🏢 Official - Maintained by BMAD team
     👥 Community - Shared by users
     🔒 Private - Your organization
     💾 Local - On your machine
     🌐 Remote - From template registry
     ```
   - Display trust indicators
   - Show last update date
   - Include compatibility info

## Code Examples, Data Structures & Constraints

```typescript
// Template metadata structure
interface Template {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'deployment' | 'testing' | 'documentation' | 'custom';
  icon: string;  // emoji or unicode character
  author: {
    name: string;
    avatar?: string;
    verified: boolean;
  };
  stats: {
    rating: number;      // 0-5
    downloads: number;
    reviews: number;
    lastUpdated: Date;
  };
  requirements: {
    tools?: string[];    // Required CLI tools
    runtime?: string;    // Node version, Python version, etc.
    platform?: string[]; // OS compatibility
  };
  sections: Array<{
    name: string;
    stepCount: number;
    estimated_time: string;
  }>;
  variables: Array<{
    name: string;
    type: string;
    required: boolean;
    default?: any;
    description: string;
    validation?: string;  // Regex or validation rule
  }>;
  tags: string[];
  version: string;
  source: 'official' | 'community' | 'private' | 'local';
}

// Search and filter system
interface TemplateFilter {
  search?: string;
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  duration?: '<30' | '30-60' | '>60';  // minutes
  source?: string[];
  hasRating?: number;  // minimum rating
  sortBy?: 'popular' | 'recent' | 'rating' | 'alphabetical';
}

// Template gallery renderer
class TemplateGallery {
  renderCard(template: Template, selected: boolean): string {
    const rating = '⭐'.repeat(Math.floor(template.stats.rating));
    const highlight = selected ? ansi.inverse : '';
    
    return `
    ${highlight}┌─────────────────────────────────────────┐${ansi.reset}
    ${highlight}│ ${template.icon} ${template.name.padEnd(25)} ${rating} │${ansi.reset}
    ${highlight}│ ${truncate(template.description, 40)}   │${ansi.reset}
    ${highlight}│ ${template.sections.length} sections • ~${estimatedTime(template)} │${ansi.reset}
    ${highlight}└─────────────────────────────────────────┘${ansi.reset}
    `;
  }
  
  renderPreview(template: Template): string {
    const sections = template.sections
      .map(s => `├─ ${s.name} (${s.stepCount} steps)`)
      .join('\n');
    
    const variables = template.variables
      .filter(v => v.required)
      .map(v => `• ${v.name} - ${v.description}`)
      .join('\n');
    
    return `
    Description:
    ${wrapText(template.description, 50)}
    
    Sections:
    ${sections}
    
    Required Variables:
    ${variables}
    
    Author: ${template.author.name} │ Updated: ${relativeTime(template.stats.lastUpdated)}
    `;
  }
}

// Initialization wizard state
interface InitWizard {
  currentStep: number;
  totalSteps: number;
  template: Template;
  values: Record<string, any>;
  validation: Record<string, boolean>;
  
  canProceed(): boolean {
    return Object.values(this.validation).every(v => v);
  }
}
```

**IMPORTANT CONSTRAINTS:**
- MUST handle 100+ templates efficiently
- MUST validate all variables before initialization
- DO NOT allow initialization with missing required vars
- Support offline template caching
- Implement lazy loading for previews
- Cache search results for performance
- Limit preview rendering to visible items
- Support template versioning

## Strict Scope

You should ONLY create:
- Template gallery with cards/list view
- Search and filter interface
- Template preview panel
- Initialization wizard
- Category navigation
- Keyboard shortcuts for selection

You should NOT create:
- Template creation/editing
- Template upload/publishing
- User authentication
- Network sync features
- Template execution engine
- File system operations

## Visual Examples

**Main Template Gallery:**
```
╔════════════════════ Checklist Templates ═══════════════════════╗
║ 📚 Browse Templates         Search: [          ] 🔍           ║
║                                                                 ║
║ Categories: [All(17)] Dev(8) Deploy(4) Test(3) Custom(2)      ║
║ Sort: [Popular ▼] Filter: [All difficulties ▼]                ║
╠═════════════════════════════════════════════════════════════════╣
║                                                                 ║
║ ┌──────────────────────────┐ ┌──────────────────────────┐    ║
║ │ 🚀 Quick Deploy          │ │ 🧪 Test Suite Setup      │    ║
║ │ ⭐⭐⭐⭐⭐ (4.9) 2.3k     │ │ ⭐⭐⭐⭐ (4.2) 891        │    ║
║ │ Full deployment pipeline │ │ Complete test framework  │    ║
║ │ 15 steps • ~30 min       │ │ 18 steps • ~45 min       │    ║
║ │ [Intermediate]           │ │ [Advanced]               │    ║
║ └──────────────────────────┘ └──────────────────────────┘    ║
║                                                                 ║
║ ┌──────────────────────────┐ ┌──────────────────────────┐    ║
║ │ 📦 Node.js API           │ │ 🐳 Docker Setup          │    ║
║ │ ⭐⭐⭐⭐ (4.5) 1.5k       │ │ ⭐⭐⭐⭐⭐ (4.8) 3.2k     │    ║
║ │ Express.js REST API      │ │ Complete containerization│    ║
║ │ 23 steps • ~60 min       │ │ 12 steps • ~20 min       │    ║
║ │ [Beginner]               │ │ [Intermediate]           │    ║
║ └──────────────────────────┘ └──────────────────────────┘    ║
║                                                                 ║
║ Page 1 of 3  [→] Next  [1-4] Select  [Enter] Preview         ║
╚═════════════════════════════════════════════════════════════════╝
 [/] Search  [f] Filter  [s] Sort  [Enter] Select  [?] Help
```

**Template Detail Preview:**
```
╔═══════════════ Template: Node.js API Setup ════════════════╗
║ 📦 Production-Ready Node.js API                           ║
║ ⭐⭐⭐⭐⭐ 4.8/5 (127 reviews) │ 1,247 uses this month    ║
║ ─────────────────────────────────────────────────────────  ║
║                                                             ║
║ Description:                                                ║
║ Complete checklist for setting up a production-ready       ║
║ Node.js API with Express.js. Includes authentication,      ║
║ database setup, testing, documentation, and deployment.    ║
║                                                             ║
║ What you'll set up:                                        ║
║ ✓ Express.js server with middleware                       ║
║ ✓ PostgreSQL/MongoDB database connection                  ║
║ ✓ JWT authentication & authorization                      ║
║ ✓ Input validation & error handling                       ║
║ ✓ Unit & integration tests with Jest                      ║
║ ✓ API documentation with Swagger                          ║
║ ✓ Docker containerization                                 ║
║ ✓ CI/CD pipeline configuration                            ║
║                                                             ║
║ Structure:                                                  ║
║ ├─ 📁 Project Setup (5 steps, ~10 min)                   ║
║ ├─ 🔧 Configuration (4 steps, ~8 min)                    ║
║ ├─ 💾 Database Setup (3 steps, ~12 min)                  ║
║ ├─ 🔐 Authentication (4 steps, ~15 min)                  ║
║ ├─ 🧪 Testing Setup (3 steps, ~10 min)                   ║
║ └─ 🚀 Deployment (4 steps, ~5 min)                       ║
║                                                             ║
║ Requirements:                                               ║
║ • Node.js 18+ installed                                   ║
║ • npm or yarn package manager                             ║
║ • Docker (optional, for containerization)                 ║
║ • PostgreSQL or MongoDB                                   ║
║                                                             ║
║ [Use Template] [Customize] [Share] [★ Favorite]           ║
╚══════════════════════════════════════════════════════════════╝
```

**Initialization Wizard:**
```
╔════════════ Initialize: Node.js API Setup ═════════════╗
║ Step 2 of 3: Configure Options                        ║
║ ────────────────────────────────────────────────────   ║
║                                                         ║
║ Database Selection:                                    ║
║ ┌─────────────────────────────────────────────┐      ║
║ │ ○ PostgreSQL (Recommended)                  │      ║
║ │   Robust, ACID-compliant, great for         │      ║
║ │   relational data                            │      ║
║ │                                              │      ║
║ │ ● MongoDB                                    │      ║
║ │   Document-based, flexible schema,          │      ║
║ │   good for rapid prototyping                │      ║
║ │                                              │      ║
║ │ ○ MySQL                                      │      ║
║ │   Popular, well-supported, reliable         │      ║
║ │                                              │      ║
║ │ ○ SQLite (Development only)                 │      ║
║ │   File-based, zero-configuration            │      ║
║ └─────────────────────────────────────────────┘      ║
║                                                         ║
║ Authentication Method:                                 ║
║ [✓] JWT tokens                                        ║
║ [ ] OAuth 2.0                                         ║
║ [ ] Basic Auth                                        ║
║                                                         ║
║ Include Optional Features:                            ║
║ [✓] API Rate limiting                                 ║
║ [✓] Request logging                                   ║
║ [ ] WebSocket support                                 ║
║ [ ] GraphQL endpoint                                  ║
║                                                         ║
║ Progress: [████████░░░░░░░░] 2/3                     ║
║                                                         ║
║ [← Back] [Next →] [Cancel]                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Search Results:**
```
╔═════════════ Search: "docker" - 4 results ═════════════╗
║                                                         ║
║ 🐳 Docker Complete Setup                    BEST MATCH ║
║ Full Docker and Docker Compose configuration          ║
║ Relevance: ████████░░ 85%                            ║
║ Matches: title, 8 steps mention Docker                ║
║                                                         ║
║ ☸️  Kubernetes Deployment                              ║
║ Deploy applications to K8s cluster                     ║
║ Relevance: ██████░░░░ 60%                            ║
║ Matches: uses Docker images, container registry       ║
║                                                         ║
║ 🚢 Microservices Template                             ║
║ Multi-service architecture with containers            ║
║ Relevance: █████░░░░░ 50%                            ║
║ Matches: Docker Compose for orchestration             ║
║                                                         ║
║ 🔧 CI/CD Pipeline                                     ║
║ Automated build and deployment pipeline               ║
║ Relevance: ███░░░░░░░ 30%                            ║
║ Matches: Docker build step in workflow                ║
║                                                         ║
║ [↑↓] Navigate  [Enter] Select  [ESC] Clear search    ║
╚═══════════════════════════════════════════════════════════╝
```

Remember: The template selection screen is users' entry point to productivity. Clear categorization, detailed previews, and smooth initialization flow are essential for helping users start with the right template quickly.