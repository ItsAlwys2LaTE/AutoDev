# AutoDev: Autonomous AI Software Architect (BUILD SYS.v2.0.0.Alpha)

AutoDev is an automated, multi-agent Software Development Life Cycle (SDLC) pipeline. It takes a plain-text feature request and autonomously orchestrates the generation of requirements, system architecture, source code, local unit test execution, and rigorous AI peer review.

## Current State: Phase 3 Completed

The system currently implements a strict, modular pipeline utilizing Google's Gemini models for structured output generation, a secure local sandbox for code execution, and a LangGraph-powered Arbitration Engine for self-correction.

### Phase 1: SYS.REQ_COMPILER (Requirements Engineering)
- **Agent:** `requirements_agent.py`
- **Function:** Ingests a plain-text feature request and translates it into a strict JSON `RequirementsDocument` containing User Stories and testable Acceptance Criteria (ACs).

### Phase 2: SYS.ARCH_MAPPER (System Design & Architectural Blueprinting)
- **Agent:** `design_agent.py`
- **Function:** Ingests the JSON requirements and outputs a structured `SystemDesignBlueprint`. This includes architectural patterns, file ordering, and detailed multi-line pseudocode.

### Phase 2b: SYS.CODE_GEN (Code Generation)
- **Agent:** `codegen_agent.py`
- **Function:** Ingests the Blueprint and Requirements to write production-ready Python source code (`.py` files) and comprehensive `pytest` unit test suites.

### Phase 2c: Local Execution Sandbox
- **Module:** `executor.py`
- **Function:** Creates a secure Python `tempfile.TemporaryDirectory()`, writes the generated files to disk, executes `pytest` against the AI-generated code, and returns the raw execution logs. (The temporary directory is automatically deleted after execution).

### Phase 3: Arbitration Engine & Adjudication (LangGraph)
- **Modules:** `critics.py`, `orchestrator.py`
- **Function:** Uses a parallel fan-out/fan-in LangGraph state graph. Three separate AI Critics (Correctness, Architecture, Completeness) evaluate the code and test results. An Adjudicator then reviews the critiques and issues a final verdict (Pass/Revise) along with a detailed revision plan.

### Phase 3.5: SYS.DOC_GEN (Documentation Generation)
- **Agent:** `documentation_agent.py`
- **Function:** Ingests the Requirements, Blueprint, and Final Codebase after a successful arbitration pass. It automatically generates a `README.md` and `USER_GUIDE.md` utilizing rich markdown, which are seamlessly injected back into the IDE for review and download.

## Model Architecture

The system utilizes semantic API keys to prevent rate-limit overlaps and distributes the workload across the latest Gemini models:

- **Primary Model:** `gemini-3.6-flash` (Optimized for coding, tool use, and multi-step workflows).
- **Fallback Model:** `gemini-3.5-flash-lite` (Automatically triggered via robust `try/except` blocks if the primary model fails or rate-limits).

## Directory Structure

```text
AutoDev/
├── README.md                  # Project overview and run instructions
└── backend/
    ├── requirements.txt       # Python dependencies (fastapi, pytest, langgraph, etc.)
    ├── main.py                # The FastAPI web server and API routes
    ├── models.py              # Pydantic data schemas (Shared state)
    ├── executor.py            # Local sandbox execution logic
    ├── orchestrator.py        # LangGraph Arbitration Engine state graph
    ├── index.html             # The Tailwind/JS frontend dashboard
    └── agents/
        ├── requirements_agent.py  # Phase 1: Feature -> Requirements
        ├── design_agent.py        # Phase 2: Requirements -> Blueprint
        ├── codegen_agent.py       # Phase 2b: Blueprint -> Code
        ├── documentation_agent.py # Phase 3.5: Final Code -> README/Guide
        └── critics.py             # Phase 3: Parallel AI Critics
```

## Recent Features & Enhancements

- **Dockerized Execution & Preview Engine (v2.0.0):** Completely overhauled the sandbox and preview architecture to use Docker containers. AutoDev now dynamically pulls isolated Docker images (like `node:20-alpine`) to execute test suites securely. The Live Preview tab now supports complex bundled applications (React/Vite/Next.js) by dynamically forwarding dev server ports (e.g., `npm run dev`) from the isolated container directly to your browser iframe.
- **Embedded Live Preview UI & Universal Testing Engine (v1.5.0):** Added a Live Preview toggle to the IDE that dynamically compiles and renders static web apps (HTML/CSS/JS) into a secure iframe for real-time visualization alongside the generated code. Upgraded the sandbox executor and agents to enforce test generation and execution for *all* tech stacks—including utilizing Jest and JSDOM to strictly test static frontends instead of bypassing them.
- **Polyglot & Multi-Language Support (v1.4.0):** The SDLC pipeline now supports any mainstream programming language and framework (e.g., Node.js, HTML/CSS/JS web apps, Java, Python). The sandbox dynamically determines the stack, builds the appropriate execution commands, and intelligently bypasses testing for static frontend projects.
- **Documentation Generation Agent (Phase 3.5):** Introduced a brand new agent workflow triggered automatically when the Arbitration Engine passes the codebase. It generates rich-markdown `README.md` and `USER_GUIDE.md` files from the context of the blueprint/requirements, which instantly appear in the Monaco IDE for download.
- **Completeness Critic Migration:** Migrated the Completeness Critic away from Groq's Llama 3 models to Gemini. This fixes an 8k Tokens-Per-Minute (TPM) crash occurring on Groq's free tier by leveraging Gemini's massive 1M+ token context window for large architecture payload analysis.
- **Self-Correction Loop (Autonomous Self-Healing):** The system now automatically routes Adjudicator "Revise" verdicts back to the CodeGen agent, supplying it with the execution logs and revision plan to regenerate and re-test the code up to 3 times autonomously.
- **Rate Limit & Infinite Loop Safeguards:** Enhanced the LangGraph Arbitration Engine to distinguish between "Code Issues" and "System/API Errors". If a critic hits a rate limit (e.g. Gemini 429), the Adjudicator outputs a graceful 'error' verdict instead of a blind 'revise', breaking the automation loop to prevent useless code regeneration hallucinations.
- **Rich Text Editability:** Replaced raw JSON outputs in Phase 1 (Requirements) and Phase 2 (Architecture) with a highly user-friendly, Word-document-like rich text interface. Users can freely edit the generated specifications. When advancing to the next phase, the backend utilizes Gemini to parse the free-form text back into the strict JSON Pydantic schemas needed by downstream agents.
- **Interactive Pipeline Stepper:** Added a visual progress stepper to the dashboard that animates sequentially (idle → loading → success/error) as each phase completes, providing real-time visibility into the autonomous workflow.
- **Download Generated Codebase (.zip):** Added a one-click "Download .zip" button to the Phase 2b output section. It uses JSZip to bundle the AI-generated source files, tests, and a fallback README directly in the browser so users can instantly run their newly generated project locally.
- **Real-Time Streaming Output (SSE):** Upgraded the LangGraph execution pipelines and frontend fetch calls to utilize Server-Sent Events (SSE). The user now sees the LLM generating the Requirements, Blueprint, and Codebase token-by-token in real-time before it smoothly snaps into the structured rich text formats.
- **Embedded Monaco IDE:** Completely revamped the Code Generation output phase to feature a fully interactive IDE powered by Monaco Editor (VS Code's engine). Users can browse generated files in a sidebar and edit the Python code directly in the browser with syntax highlighting. Edits are flushed to the execution sandbox when running tests.
- **Global Token & Cost Tracker:** Implemented a real-time token tracking widget in the UI header. The streaming backends intercept the `usage_metadata` from the Google GenAI SDK and pass it to the frontend via stream delimiters, calculating the estimated session cost on the fly without breaking the SSE structure.
- **Test Coverage Analysis:** Integrated `pytest-cov` into the local execution sandbox. When tests are executed, the backend analyzes source code line coverage and automatically surfaces the total coverage percentage directly in the UI alongside the execution logs.

## Setup & Execution

### 0. Prerequisites: Install Docker
AutoDev v2.0 utilizes isolated Docker containers for its execution sandbox and Live Preview engine. 
- **Windows/Mac:** You must have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- **Linux:** You must have the [Docker Engine](https://docs.docker.com/engine/install/) installed and running.
*(Ensure the Docker daemon is active in the background before starting the application).*

### 1. Install Dependencies

Ensure you have Python 3.10+ installed. Navigate to the `backend/` directory and run:

```bash
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file in the `backend/` directory and configure your distinct agent keys:

```env
# Phase 1 & 2 Agents
GEMINI_API_KEY_REQUIREMENTS=your_api_key_here
GEMINI_API_KEY_DESIGN=your_api_key_here
GEMINI_API_KEY_CODEGEN=your_api_key_here

# Phase 3 Parallel Critics (Multi-LLM)
GEMINI_API_KEY_CRITICS=your_api_key_here
MISTRAL_API_KEY=your_api_key_here
GROQ_API_KEY=your_api_key_here
```

*(You can use the same key for all if you do not need strict quota segmentation).*

### 3. Start the Application

Boot up the FastAPI server:

```bash
uvicorn main:app --reload
```

### 4. Run the Pipeline

1. Open `http://localhost:8000` in your browser.
2. Enter a feature request (e.g., "Build an email validation utility").
3. Click through the sequential UI phases (Phase 1 -> Phase 2 -> Phase 2b -> Phase 2c -> Phase 3) to watch the AI build, test, and peer-review the software autonomously.

## Contributors

Aman Adil, Amit Sahu, Anupam Sharma (Bhilai Institute of Technology, Durg)
