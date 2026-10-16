# AutoDev

**Autonomous Multi-Agent Software Engineering Platform -- v3.0.0**

AutoDev is an autonomous software engineering platform that converts natural-language product descriptions into fully realized, production-ready, multi-file software repositories. The system models the disciplined workflows of high-performing engineering teams through a coordinated network of specialized AI agents, a mathematical DAG-based parallel pipeline scheduler, an integrated multi-critic arbitration network, and a glassmorphic real-time dashboard.

Users describe what they want to build in plain English. AutoDev handles everything else: requirements formalization, architectural decomposition, concurrent component development, code generation, automated testing, peer review arbitration, cross-component integration, documentation synthesis, and live preview rendering.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [The 12-Stage Development Pipeline](#2-the-12-stage-development-pipeline)
3. [Multi-Agent Subsystem](#3-multi-agent-subsystem)
4. [Parallel DAG Pipeline Engine](#4-parallel-dag-pipeline-engine)
5. [Arbitration and Revision System](#5-arbitration-and-revision-system)
6. [Smart API Key Balancer](#6-smart-api-key-balancer)
7. [User Interface](#7-user-interface)
8. [Authentication and User Profiles](#8-authentication-and-user-profiles)
9. [Technology Stack](#9-technology-stack)
10. [Project Structure](#10-project-structure)
11. [Setup and Installation](#11-setup-and-installation)
12. [Environment Variables](#12-environment-variables)
13. [Running the Application](#13-running-the-application)
14. [Testing](#14-testing)
15. [Contributors](#15-contributors)

---

## 1. System Architecture

AutoDev is structured as a monorepo with a FastAPI backend serving both the REST API and the production frontend build. The backend orchestrates all AI agent interactions through Google Gemini models, while the React frontend provides a real-time glassmorphic dashboard for monitoring and interacting with every stage of the development lifecycle.

```
                        +---------------------+
                        |   Browser Client    |
                        |  (React + Vite SPA) |
                        +----------+----------+
                                   |
                            HTTP / SSE
                                   |
                        +----------v----------+
                        |   FastAPI Backend    |
                        |   (Uvicorn ASGI)     |
                        +----------+----------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
     +--------v--------+  +-------v--------+  +-------v--------+
     | Key Balancer     |  | DAG Scheduler  |  | Auth System    |
     | (7 API Keys,     |  | (Kahn Sort,    |  | (JWT, OAuth,   |
     |  Rate Limiting,  |  |  Lease Locks,  |  |  MongoDB Atlas)|
     |  Backoff)        |  |  Concurrency)  |  |                |
     +--------+---------+  +-------+--------+  +----------------+
              |                    |
     +--------v--------+  +-------v--------+
     | Gemini Models    |  | Agent Network  |
     | (gemini-3.5-     |  | (10 Agents)    |
     |  flash-lite,     |  |                |
     |  gemini-3.6-     |  +----------------+
     |  flash)          |
     +-----------------+
```

---

## 2. The 12-Stage Development Pipeline

AutoDev operates through a 12-stage sequential pipeline. Each stage represents a distinct phase of the software development lifecycle, from initial authentication through to post-development support.

| Stage | Name | Description |
|-------|------|-------------|
| 1 | **Sign In** | User authentication via email/password or Google OAuth. |
| 2 | **Product Request** | User enters a natural-language description of the software they want built. |
| 3 | **Product Enquiry Agent** | AI agent analyzes the request, generates a product summary, development strategy, technology recommendations, and follow-up clarification questions. |
| 4 | **Requirements** | Requirements Modeling Agent transforms the product description into a structured requirements document with user stories and acceptance criteria. |
| 5 | **Decomposition** | Master Architect Agent decomposes the architecture into a Directed Acyclic Graph (DAG) of modular components with explicit dependency edges. |
| 6 | **Component Pipeline** | Parallel DAG-scheduled execution of each component through Design, Codegen, Sandbox Testing, and Critics/Arbitration stages. Components with no unmet dependencies execute concurrently. |
| 7 | **Integration** | Integration Agent merges all completed components into a unified codebase with shared routing, imports, and end-to-end test coverage. Includes integration-level critic arbitration. |
| 8 | **Final Source Code** | Complete synthesized codebase displayed in an embedded Monaco IDE with file explorer, syntax highlighting, and download/export options. |
| 9 | **Live Preview** | Responsive multi-device viewport emulation (desktop, tablet, iPhone, iPad) with Dynamic Island bezels for mobile previews. |
| 10 | **Development Results** | Final results dashboard with development progression graph, Gantt chart with chronological phase durations, session cost metrics, and one-click GitHub export. |
| 11 | **Post-Dev Support (beta)** | Users can submit natural-language modification or enhancement requests against the generated codebase. |
| 12 | **Post-Dev Execution (beta)** | Refactor Agent processes the modification request and produces updated source code. |

---

## 3. Multi-Agent Subsystem

AutoDev coordinates 10 specialized AI agents, each responsible for a distinct phase of the development lifecycle:

| Agent | Role | Stage |
|-------|------|-------|
| **Product Enquiry Agent** | Analyzes the raw product request and produces a structured summary with development strategy, technology recommendations, and clarifying follow-up questions. | 3 |
| **Requirements Agent** | Converts the product description into formal user stories, acceptance criteria, and technical constraints. | 4 |
| **Master Architect** | Decomposes the requirements into a DAG of loosely-coupled components with dependency edges, interface contracts, and data flow specifications. | 5 |
| **Design Agent** | Generates detailed architectural blueprints for each component: module structure, API contracts, data models, and integration interfaces. | 6 |
| **Codegen Agent** | Produces multi-file source code implementations from the design blueprint, respecting the specified technology stack and coding conventions. | 6 |
| **Critic Agents (3x)** | Three independent peer reviewers (Correctness, Completeness, Architecture) evaluate generated code against the blueprint and requirements. | 6 |
| **Master Adjudicator** | Synthesizes critic verdicts into a final pass/fail decision with consolidated revision directives. | 6 |
| **Integration Agent** | Merges all passing component codebases into a unified project with shared configuration, routing, and cross-component test coverage. | 7 |
| **Documentation Agent** | Generates README, user guides, and inline documentation for the completed project. | 7 |
| **Refactor Agent** | Processes post-development modification requests and produces targeted code changes. | 12 |

---

## 4. Parallel DAG Pipeline Engine

The Component Pipeline (Stage 6) uses a mathematical DAG engine to maximize development throughput through concurrent execution.

**How it works:**

1. The Master Architect decomposes requirements into components with explicit dependency edges (e.g., "Auth Service" must complete before "Dashboard" can begin).
2. The DAG engine performs a topological sort (Kahn's algorithm) to determine valid execution orderings.
3. Components with all dependencies satisfied are scheduled concurrently.
4. Each component progresses through a staged track: Design, Codegen, Sandbox Execution, and Critics/Arbitration.
5. Lease-backed single-occupancy locks prevent duplicate scheduling of the same component.
6. Passing components are released to dependents; failing components enter a bounded revision loop (max 3 iterations).

**Component Track Lifecycle:**

```
queued -> designing -> coding_queued -> coding -> critic_queued ->
critics -> [PASS: synthesized] | [FAIL: revision loop -> designing]
```

---

## 5. Arbitration and Revision System

Code quality is enforced through a multi-critic peer review network:

1. **Three Independent Critics** evaluate each component's generated code:
   - Correctness Critic: verifies functional accuracy against requirements.
   - Completeness Critic: checks for missing features, edge cases, and error handling.
   - Architecture Critic: evaluates structural quality, modularity, and design patterns.

2. **Master Adjudicator** synthesizes all three critic reports into a unified verdict:
   - **PASS**: Component advances to synthesized status.
   - **FAIL**: Component re-enters the design phase with consolidated revision directives.

3. **Bounded Revision Loops**: Maximum 3 revision iterations per component during pipeline execution, and maximum 5 revisions during the integration phase.

4. **Integration-Level Arbitration**: After all components are merged, the integrated codebase undergoes its own critic review and arbitration cycle.

---

## 6. Smart API Key Balancer

The Key Balancer manages up to 7 dedicated Google Gemini API keys, distributing them across pipeline stages to prevent rate limiting and maximize throughput.

**Key Features:**
- **Stage-Isolated Keys**: Each pipeline stage (Requirements, Decomposition, Design, Codegen, Critics, Adjudicator, Integration) can have its own dedicated API key.
- **Numbered Fallback Pool**: Keys numbered 1 through 7 serve as a secondary fallback mapping.
- **Universal Fallback**: A single `GEMINI_API_KEY` serves as the universal fallback when stage-specific keys are unavailable.
- **Rate Limit Detection**: Automatic detection of 429/Resource Exhausted errors with exponential backoff and key rotation.
- **User-Configurable Models**: Users can specify custom primary and fallback models through their profile settings.
- **Default Models**: `gemini-3.5-flash-lite` (primary), `gemini-3.6-flash` (for complex reasoning).

---

## 7. User Interface

AutoDev's frontend is built with a glassmorphic design system inspired by Apple's iOS/visionOS visual language.

**Design System:**
- Deep frosted obsidian translucency with multi-layered backdrop blur across all panels and containers.
- Specular refraction borders and subtle inner highlights on interactive elements.
- AeroShards WebGPU 3D ambient background rendering dynamic wind-sculpture particles behind all UI layers, with graceful CSS gradient fallback when WebGPU is unavailable.
- Full dark and light mode support with system-preference detection.
- Liquid stage transition animations powered by Framer Motion.
- Dynamic favicon that reflects the current pipeline stage.

**Key UI Components:**
- **Stepper Progress Bar**: Visual pipeline navigation showing all 12 stages with active state indicators.
- **Floating Action Button (FAB)**: Dynamic pause/resume/restart controls that expand from a single button during active development. Hidden on completion.
- **Monaco IDE**: Embedded code editor with syntax highlighting, file explorer tree, and multi-file navigation for inspecting generated code.
- **Live Preview**: Multi-device viewport emulation with responsive breakpoints and mobile bezels.
- **Gantt Chart**: Interactive chronological development timeline showing per-phase and per-component execution durations.
- **Development Progression Graph**: SVG-based agent milestone visualization with duration annotations.
- **GitHub Export Modal**: One-click commit of the generated codebase to a user's GitHub repository.
- **Terminal Drawer**: Real-time log streaming from the backend pipeline with collapsible drawer interface.
- **Right Sidebar**: Session cost tracking, user profile access, and dark mode toggle.
- **Toast Notifications**: Glassmorphic notification system for pipeline events.

**Pause, Modify, and Resume:**

During active development, users can:
1. Pause the pipeline at any point.
2. Inspect and edit outputs from the Requirements, Design, Codegen, or Integration phases.
3. Resume development. The system detects all modifications and automatically rewinds to the earliest modified phase, re-executing only the affected downstream stages.

---

## 8. Authentication and User Profiles

**Authentication Methods:**
- Email/password registration with OTP email verification (via Brevo/Sendinblue SMTP).
- Google OAuth 2.0 sign-in.
- JWT-based session management with secure token storage.

**User Profile System:**
- Development preferences: preferred programming languages, frameworks, coding style.
- AI configuration: custom Gemini API key, primary and fallback model selection.
- GitHub integration: stored username, repository, and personal access token for one-click export.
- Session history: browsable list of past development sessions with cost metrics.

**Data Storage:**
- MongoDB Atlas for user accounts, sessions, and profile data.
- Motor (async MongoDB driver) for non-blocking database operations.

---

## 9. Technology Stack

### Backend

| Technology | Purpose |
|------------|---------|
| Python 3.11+ | Runtime |
| FastAPI | Web framework and REST API |
| Uvicorn | ASGI server |
| Pydantic | Data validation and serialization |
| Google GenAI SDK | Gemini model interactions |
| Motor / PyMongo | Async MongoDB driver |
| python-jose | JWT token encoding/decoding |
| passlib | Password hashing (bcrypt) |
| python-dotenv | Environment variable management |
| httpx | Async HTTP client (Google OAuth) |
| google-auth | Google OAuth token verification |

### Frontend

| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| TypeScript 5.x | Type-safe JavaScript |
| Vite 6 | Build tool and dev server |
| Tailwind CSS 3 | Utility-first CSS framework |
| Zustand | Lightweight state management |
| Framer Motion | Animation library |
| Monaco Editor | Embedded code editor (VSCode engine) |
| GSAP | Advanced animation sequences |
| vgpu | WebGPU rendering (AeroShards background) |
| OGL | WebGL fallback rendering |
| JSZip | Client-side ZIP file generation |
| TanStack React Query | Server state management |
| Vitest | Testing framework |
| Testing Library | Component testing utilities |

---

## 10. Project Structure

```
AutoDev-main/
|-- autodev-frontend/           # React frontend application
|   |-- src/
|   |   |-- api/                # HTTP client and API endpoint functions
|   |   |-- assets/             # Static assets
|   |   |-- components/         # Shared UI components
|   |   |   |-- AeroShards.tsx          # WebGPU 3D ambient background
|   |   |   |-- DarkModeToggle.tsx      # Theme switcher
|   |   |   |-- GitHubExportModal.tsx   # GitHub commit modal
|   |   |   |-- Header.tsx             # Application header
|   |   |   |-- PauseModifyFAB.tsx     # Floating action button
|   |   |   |-- SmoothInput.tsx        # Glassmorphic textarea
|   |   |   |-- SpecularButton.tsx     # Frosted glass button
|   |   |   |-- StepperProgress.tsx    # Pipeline stepper
|   |   |   |-- Terminal.tsx           # Log terminal drawer
|   |   |   +-- ...
|   |   |-- features/           # Feature-specific modules
|   |   |   |-- decomposition/  # Architecture decomposition UI
|   |   |   |-- design/         # Blueprint display
|   |   |   |-- execution/      # Sandbox execution output
|   |   |   |-- ide/            # Monaco IDE integration
|   |   |   |-- input/          # Product request input
|   |   |   |-- integration/    # Integration phase UI
|   |   |   |-- pipeline/       # Component pipeline dashboard
|   |   |   |-- post-completion/ # Post-dev support UI
|   |   |   |-- profile/        # User profile pages
|   |   |   |-- requirements/   # Requirements display
|   |   |   +-- stages/         # All 12 stage view components
|   |   |-- hooks/              # Custom React hooks
|   |   |-- lib/                # Utility libraries
|   |   |-- services/           # Notification and export services
|   |   |-- stores/             # Zustand state stores
|   |   |   |-- appStore.ts     # Core pipeline state
|   |   |   |-- authStore.ts    # Authentication state
|   |   |   |-- persistence.ts  # LocalStorage persistence
|   |   |   +-- sessionStore.ts # Session and cost tracking
|   |   |-- types/              # TypeScript type definitions
|   |   +-- utils/              # Utility functions
|   |-- tests/                  # Vitest test suite (49 files, 711 tests)
|   |-- index.html              # SPA entry point
|   +-- package.json            # Frontend dependencies
|
|-- backend/                    # FastAPI backend server
|   |-- agents/                 # AI agent implementations
|   |   |-- codegen_agent.py
|   |   |-- critics.py
|   |   |-- design_agent.py
|   |   |-- documentation_agent.py
|   |   |-- integrator_agent.py
|   |   |-- master_architect.py
|   |   |-- product_enquiry_agent.py
|   |   |-- refactor_agent.py
|   |   |-- requirements_agent.py
|   |   +-- revision_extractor.py
|   |-- autodev_pipeline/       # DAG engine and scheduler
|   |   |-- concurrency.py     # Lease locks and mutex
|   |   |-- dag_engine.py      # Topological sort and scheduling
|   |   |-- fault_tolerance.py # Error recovery
|   |   |-- models.py          # Pipeline data models
|   |   +-- scheduler.py       # Component track state machine
|   |-- dist/                   # Production frontend build output
|   |-- auth.py                 # JWT and authentication logic
|   |-- auth_models.py          # Auth data models
|   |-- auth_routes.py          # Auth API endpoints
|   |-- code_extractor.py       # Source code parsing utilities
|   |-- database.py             # MongoDB connection management
|   |-- email_service.py        # Brevo SMTP email service
|   |-- key_balancer.py         # API key rotation and rate limiting
|   |-- log_stream.py           # SSE log streaming
|   |-- main.py                 # FastAPI application entry point
|   |-- models.py               # Core data models
|   |-- orchestrator.py         # Agent prompt assembly and coordination
|   |-- pipeline_api.py         # Pipeline REST endpoints
|   |-- prompt_guard.py         # Input sanitization
|   |-- retry.py                # Exponential backoff utilities
|   |-- session_models.py       # Session data models
|   |-- session_routes.py       # Session API endpoints
|   +-- requirements.txt        # Python dependencies
|
|-- AutoDev_UI/                 # UI reference screenshots
|-- Project Documentation/      # Academic project reports
|-- document.md                 # Internal system documentation
+-- .gitignore
```

---

## 11. Setup and Installation

### Prerequisites

- Python 3.11 or later
- Node.js 18+ and npm (for frontend development only; production builds are pre-compiled)
- A Google Gemini API key (at minimum one; up to 7 recommended for load distribution)
- MongoDB Atlas cluster (free tier works for development)

### Clone the Repository

```bash
git clone https://github.com/ItsAlwys2LaTE/AutoDev.git
cd AutoDev
```

### Install Backend Dependencies

```bash
cd backend
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### Install Frontend Dependencies (Development Only)

The production frontend is pre-built and served from `backend/dist/`. For frontend development:

```bash
cd autodev-frontend
npm install
```

---

## 12. Environment Variables

Create a `.env` file inside the `backend/` directory with the following variables:

### Required

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Universal fallback Google Gemini API key. At minimum, one valid key is required. |
| `MONGODB_URI` | MongoDB Atlas connection string (e.g., `mongodb+srv://user:pass@cluster.mongodb.net/autodev`). |
| `JWT_SECRET_KEY` | Secret key for JWT token signing. Use a long random string. |

### API Key Pool (Recommended)

For optimal throughput, assign dedicated keys to each pipeline stage:

| Variable | Stage |
|----------|-------|
| `GEMINI_API_KEY_REQUIREMENTS` | Requirements and Product Enquiry agents |
| `GEMINI_API_KEY_MASTER_ARCHITECT` | Master Architect and Decomposition |
| `GEMINI_API_KEY_DESIGN` | Design Agent |
| `GEMINI_API_KEY_CODEGEN` | Codegen Agent |
| `GEMINI_API_KEY_CRITICS` | Critic agents |
| `GEMINI_API_KEY_ADJUDICATOR` | Master Adjudicator |
| `GEMINI_API_KEY_INTEGRATION` | Integration Agent |

Alternatively, use numbered keys `GEMINI_API_KEY_1` through `GEMINI_API_KEY_7` as a fallback pool.

### Authentication

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID for sign-in. |
| `BREVO_API_KEY` | Brevo (Sendinblue) API key for OTP verification emails. |
| `BREVO_SENDER_EMAIL` | Verified sender email address for Brevo. |
| `BREVO_SENDER_NAME` | Display name for verification emails. |

### Example `.env` File

```dotenv
# Core
GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/autodev
JWT_SECRET_KEY=your_random_secret_key

# Stage-Specific API Keys (recommended)
GEMINI_API_KEY_REQUIREMENTS=key_1
GEMINI_API_KEY_MASTER_ARCHITECT=key_2
GEMINI_API_KEY_DESIGN=key_3
GEMINI_API_KEY_CODEGEN=key_4
GEMINI_API_KEY_CRITICS=key_5
GEMINI_API_KEY_ADJUDICATOR=key_6
GEMINI_API_KEY_INTEGRATION=key_7

# Authentication
GOOGLE_CLIENT_ID=your_google_client_id
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=AutoDev
```

---

## 13. Running the Application

Start the FastAPI backend with Uvicorn from the `backend/` directory:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The application will be available at `http://localhost:8000`. The backend serves both the API and the pre-built frontend from the `dist/` directory.

### Using the Application

1. Open `http://localhost:8000` in a modern browser (Chrome or Edge recommended for WebGPU support).
2. Sign in with email/password or Google OAuth.
3. Enter a natural-language product description (e.g., "Build a real-time chat application with user authentication, message history, and file sharing").
4. The Product Enquiry Agent will analyze your request and may ask follow-up questions.
5. Requirements are automatically compiled and presented for review.
6. The Master Architect decomposes the system into components.
7. The parallel pipeline develops all components concurrently through Design, Codegen, and Critics stages.
8. Integration merges all components into a unified codebase.
9. Review the final source code, live preview, and development metrics.
10. Export to GitHub or download as a ZIP archive.

### Frontend Development

For frontend development with hot reload:

```bash
cd autodev-frontend
npm run dev
```

Build the production frontend (outputs to `backend/dist/`):

```bash
cd autodev-frontend
npm run build
```

---

## 14. Testing

### Frontend Tests

The frontend includes a comprehensive test suite with 49 test files covering 711 tests:

```bash
cd autodev-frontend
npm test
```

Tests cover:
- Store state management and persistence
- Pipeline lifecycle and component tracks
- Authentication flows
- Pause/modify/resume engine and earliest-phase rewind logic
- GitHub export service
- Notification system
- UI component rendering
- Stream and JSON parsing utilities

---

## 15. Contributors

- **Aman Adil** -- Bhilai Institute of Technology, Durg
- **Amit Sahu** -- Bhilai Institute of Technology, Durg
- **Anupam Sharma** -- Bhilai Institute of Technology, Durg
