# AutoDev: AI Software Architect 🤖⚙️

**Prompt-to-PR: An Autonomous AI Coding Pipeline with Multi-Agent Arbitration**

AutoDev is an autonomous Software Development Life Cycle (SDLC) orchestrator. Instead of relying on single-shot LLM prompts that frequently generate buggy code, AutoDev utilizes a multi-agent pipeline. It takes a plain English feature request, extracts strict requirements, generates code, and then uses an **Arbitration Engine** (multiple AI critics) to test, debate, and force the system to fix its own bugs before automatically opening a GitHub Pull Request.

This project is currently being developed as a final-year B.Tech Capstone Project (Group 9).

## 📍 Current Status: Phase 1 Completed

### Phase 1: Autonomous Requirements Generation

We have successfully built the Requirements Agent. This phase acts as the "Product Manager" of the system.

- **Input:** A plain-text, vague feature request from a user.
- **Action:** Processes the request using Google's `gemini-3.5-flash` model.
- **Output:** A highly structured JSON object natively validated via Pydantic, breaking the request down into exhaustive User Stories and highly specific, testable Acceptance Criteria (ACs).

This structured ground truth is essential, as all future downstream code-generation and testing agents will rely entirely on these Acceptance Criteria.

## 🛠 Tech Stack (Current Build)

- **Backend:** Python 3.10+, FastAPI
- **AI Engine:** Google GenAI SDK (`gemini-3.5-flash`)
- **Data Validation:** Pydantic
- **Frontend:** HTML5, Tailwind CSS, JavaScript (Vanilla)

## 🚀 How to Run the Phase 1 Build

Follow these steps to run the interactive Phase 1 Web Dashboard locally on your machine.

### 1. Prerequisites

- Python 3.10 or higher installed on your system.
- A valid Google Gemini API Key.

### 2. Installation

Clone the repository and navigate into the backend directory:

```bash
git clone https://github.com/your-username/autodev.git
cd autodev/backend
```

Install the required Python dependencies:

```bash
pip install -r requirements.txt
```

### 3. Environment Setup

Create a file named `.env` inside the backend folder and add your Gemini API key:

```
GEMINI_API_KEY=your_actual_api_key_here
```

### 4. Start the Application

Run the FastAPI web server using Uvicorn:

```bash
uvicorn main:app --reload
```

### 5. Access the Dashboard

Open your web browser and navigate to: [http://localhost:8000](http://localhost:8000)

You can now type in a plain-text feature request (e.g., *"Build an email notification system for successful purchases"*) and watch the agent generate the structured JSON requirements.

## 🗺 Project Roadmap

- [x] **Phase 1:** Foundation & Requirements Extraction Agent (Current)
- [ ] **Phase 2:** Design Blueprinting, Code Generation Agent, & Local Execution Sandbox
- [ ] **Phase 3:** The Arbitration Engine (Correctness, Architecture, & Completeness Critics via LangGraph)
- [ ] **Phase 4:** The Adjudicator & Self-Correction Loop
- [ ] **Phase 5:** Deployment Agent (Automated GitHub PR integration) & React UI Dashboard

## Contributors

Aman Adil, Amit Sahu, Anupam Sharma (Bhilai Institute of Technology, Durg)
