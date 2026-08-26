# AutoDev: Autonomous AI Software Architect

AutoDev is an automated, multi-agent Software Development Life Cycle (SDLC) pipeline. It takes a plain-text feature request and autonomously orchestrates the generation of requirements, system architecture, source code, local unit test execution, and rigorous AI peer review.

## Current State: Phase 3 Completed

The system currently implements a strict, modular pipeline utilizing Google's Gemini models for structured output generation, a secure local sandbox for code execution, and a LangGraph-powered Arbitration Engine for self-correction.

### Phase 1: Requirements Engineering
- **Agent:** `requirements_agent.py`
- **Function:** Ingests a plain-text feature request and translates it into a strict JSON `RequirementsDocument` containing User Stories and testable Acceptance Criteria (ACs).

### Phase 2: System Design & Architectural Blueprinting
- **Agent:** `design_agent.py`
- **Function:** Ingests the JSON requirements and outputs a structured `SystemDesignBlueprint`. This includes architectural patterns, file ordering, and detailed multi-line pseudocode.

### Phase 2b: Code Generation
- **Agent:** `codegen_agent.py`
- **Function:** Ingests the Blueprint and Requirements to write production-ready Python source code (`.py` files) and comprehensive `pytest` unit test suites.

### Phase 2c: Local Execution Sandbox
- **Module:** `executor.py`
- **Function:** Creates a secure Python `tempfile.TemporaryDirectory()`, writes the generated files to disk, executes `pytest` against the AI-generated code, and returns the raw execution logs. (The temporary directory is automatically deleted after execution).

### Phase 3: Arbitration Engine & Adjudication (LangGraph)
- **Modules:** `critics.py`, `orchestrator.py`
- **Function:** Uses a parallel fan-out/fan-in LangGraph state graph. Three separate AI Critics (Correctness, Architecture, Completeness) evaluate the code and test results. An Adjudicator then reviews the critiques and issues a final verdict (Pass/Revise) along with a detailed revision plan.

## Model Architecture

The system utilizes semantic API keys to prevent rate-limit overlaps and distributes the workload across the latest Gemini models:

- **Primary Model:** `gemini-3.7-flash` (Optimized for coding, tool use, and multi-step workflows).
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
        └── critics.py             # Phase 3: Parallel AI Critics
```

## Setup & Execution

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

## Project Roadmap

- [x] **Phase 1:** Foundation & Requirements Extraction Agent
- [x] **Phase 2:** Design Blueprinting, Code Generation Agent, & Local Execution Sandbox
- [x] **Phase 3:** Arbitration Engine (Correctness, Architecture, & Completeness Critics via LangGraph) & Adjudicator
- [ ] **Phase 4:** Advanced UI/UX & Creative Feature Incubation
- [ ] **Phase 5:** Deployment & Final Polish

## Contributors

Aman Adil, Amit Sahu, Anupam Sharma (Bhilai Institute of Technology, Durg)
