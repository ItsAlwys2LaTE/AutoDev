from typing import TypedDict, Annotated, List, Optional, Any
import operator
import os
import json
import math
from langgraph.graph import StateGraph, END
from google import genai
from google.genai import types

from models import ComponentDecomposition, RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, ExecutionResult, CriticFeedback, AdjudicatorDecision
from agents.critics import evaluate_correctness, evaluate_architecture, evaluate_completeness
from retry import with_exponential_backoff

class GraphState(TypedDict, total=False):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint
    codebase: GeneratedCodeBase
    execution_result: ExecutionResult
    master_decomposition: Optional[ComponentDecomposition]
    # operator.add ensures that when parallel nodes return lists, they are concatenated together
    feedbacks: Annotated[List[CriticFeedback], operator.add]
    decision: AdjudicatorDecision
    revision_count: int
    generation_mode: Optional[str]
    mode: Optional[str]
    previous_composite: Optional[float]
    delta: Optional[float]
    dynamic_budget: Optional[int]

def node_correctness(state: GraphState):
    feedback = evaluate_correctness(state["requirements"], state["execution_result"], state.get("codebase"), state.get("mode"))
    return {"feedbacks": [feedback]}

def node_architecture(state: GraphState):
    feedback = evaluate_architecture(state["blueprint"], state["codebase"], state.get("master_decomposition"))
    return {"feedbacks": [feedback]}

def node_completeness(state: GraphState):
    feedback = evaluate_completeness(state["requirements"], state["blueprint"], state["codebase"], state.get("master_decomposition"))
    return {"feedbacks": [feedback]}

from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error
from pydantic import BaseModel, Field

class AdjudicatorLLMResponse(BaseModel):
    """Internal LLM response schema without default values for Gemini API."""
    verdict: str = Field(description="Strictly 'pass', 'revise', or 'error'")
    revision_plan: str = Field(description="Detailed instructions for the CodeGen agent if verdict is 'revise'. If 'error', describes the system failure. If 'pass', a brief approval message.")

def calculate_composite_score(feedbacks: List[Any]) -> float:
    """
    Calculate weighted composite score:
    Correctness 50%, Architecture 20%, Completeness 30%
    """
    correctness_score = 0.0
    architecture_score = 0.0
    completeness_score = 0.0

    for fb in feedbacks or []:
        if fb is None:
            continue
        if isinstance(fb, dict):
            name = (fb.get("critic_name") or "").lower()
            raw_score = fb.get("severity_score")
        else:
            name = (getattr(fb, "critic_name", None) or "").lower()
            raw_score = getattr(fb, "severity_score", 0)

        score = 0.0
        if raw_score is not None and not isinstance(raw_score, bool):
            try:
                score = float(raw_score)
            except (ValueError, TypeError):
                score = 0.0

        if "correct" in name:
            correctness_score = score
        elif "arch" in name:
            architecture_score = score
        elif "complete" in name:
            completeness_score = score

    composite = (correctness_score * 0.50) + (architecture_score * 0.20) + (completeness_score * 0.30)
    return round(composite, 2)


def check_critic_system_error(feedbacks: List[Any]) -> Optional[str]:
    """Check if any critic feedback reported an API Error, Rate Limit, or system failure."""
    for fb in feedbacks or []:
        comments = getattr(fb, "overall_comments", "") if not isinstance(fb, dict) else fb.get("overall_comments", "")
        issues = getattr(fb, "issues_list", []) if not isinstance(fb, dict) else fb.get("issues_list", [])
        combined = (str(comments) + " " + " ".join(str(i) for i in issues)).lower()
        if "api error" in combined or "rate limit" in combined or "system failure" in combined or "503 service unavailable" in combined:
            return str(comments) or (" ".join(str(i) for i in issues)) or "Critic system failure detected"
    return None


def synthesize_revision_plan(feedbacks: List[Any]) -> str:
    """Build a revision plan from critic issues without calling an LLM."""
    issues = []
    for fb in feedbacks or []:
        # Handle dict or Pydantic object
        if isinstance(fb, dict):
            name = fb.get("critic_name", "Critic")
            score = fb.get("severity_score", 0)
            issue_list = fb.get("issues_list", [])
        else:
            name = getattr(fb, "critic_name", "Critic")
            score = getattr(fb, "severity_score", 0)
            issue_list = getattr(fb, "issues_list", [])
            
        if score > 0:
            issues.append(f"[{name}] (severity {score}/10):")
            for issue in issue_list:
                issues.append(f"  - {issue}")
    return "\n".join(issues) if issues else "No issues found."

def node_adjudicator(state: GraphState):
    print("Running Deterministic Adjudicator...")
    feedbacks = state.get("feedbacks", [])
    execution_result = state.get("execution_result")
    revision_count = state.get("revision_count", 0)
    gen_mode = str(state.get("generation_mode") or state.get("mode") or "QUICK").upper()
    previous_composite = state.get("previous_composite")

    # GATE 1: Execution failure = mandatory revise
    # We must check if execution failed before even looking at critics.
    # Note: execution_result might be a dict or a Pydantic object
    exec_success = True
    exec_logs = ""
    if execution_result:
        if isinstance(execution_result, dict):
            exec_success = execution_result.get("success", True)
            exec_logs = execution_result.get("logs", "")
        else:
            exec_success = getattr(execution_result, "success", True)
            exec_logs = getattr(execution_result, "logs", "")

    if not exec_success:
        print("Adjudicator: Execution failed. Mandatory revise.")
        # We assign a max severity score to force revision
        budget = 3 if gen_mode == "QUICK" else 4
        log_snippet = str(exec_logs)[-2000:] if exec_logs else "No logs provided."
        decision = AdjudicatorDecision(
            verdict="revise",
            revision_plan=f"EXECUTION FAILED. The tests crashed or timed out. Fix these errors first:\n\n{log_snippet}",
            weighted_composite=10.0,
            delta=0.0,
            dynamic_budget=budget,
            early_stop=False
        )
        return {"decision": decision}

    # GATE 2: System errors in critics
    sys_err = check_critic_system_error(feedbacks)
    if sys_err:
        print(f"Adjudicator: System error detected in critic feedbacks: {sys_err}")
        return {
            "decision": AdjudicatorDecision(
                verdict="error",
                revision_plan=f"Adjudicator System Error: Evaluation failed due to critic system error ({sys_err}).",
                weighted_composite=10.0,
                delta=0.0,
                dynamic_budget=3,
                early_stop=False,
            )
        }

    # Score calculation
    composite = calculate_composite_score(feedbacks)
    # Budget: min 5, max 2, ceil(composite / 2)
    budget = min(5, max(2, math.ceil(composite / 2)))
    
    delta = None
    if previous_composite is not None and previous_composite != "" and not isinstance(previous_composite, bool):
        try:
            delta = round(float(previous_composite) - composite, 2)
        except (ValueError, TypeError):
            delta = None

    # GATE 3: Auto-pass (strict threshold)
    if composite <= 1.0:
        print(f"Adjudicator: Auto-pass triggered. Composite {composite} <= 1.0")
        return {
            "decision": AdjudicatorDecision(
                verdict="pass",
                revision_plan=f"Auto-passed: weighted composite score of {composite} is excellent.",
                weighted_composite=composite,
                delta=delta,
                dynamic_budget=budget,
                early_stop=False,
            )
        }

    # GATE 4: Early-stop (only after 2+ revisions, only if quality is acceptable <= 3.0)
    if revision_count >= 2 and delta is not None and delta <= 0.5 and composite <= 3.0:
        print(f"Adjudicator: Early stop triggered. Delta {delta} <= 0.5 and Composite {composite} <= 3.0")
        return {
            "decision": AdjudicatorDecision(
                verdict="pass",
                revision_plan=f"Early stop triggered: score improvement ({delta}) is diminishing, and quality ({composite}) is acceptable.",
                weighted_composite=composite,
                delta=delta,
                dynamic_budget=budget,
                early_stop=True,
            )
        }

    # GATE 5: Budget exhausted
    # If we haven't passed by the time we hit the budget, force a pass (or error depending on UI logic, but UI expects pass or revise-loop).
    # We will let route_decision or the UI handle the max_revisions fallback, so here we just return revise.
    
    # Default: Revise with deterministic plan
    plan = synthesize_revision_plan(feedbacks)
    print(f"Adjudicator: Revise required. Composite: {composite}")
    return {
        "decision": AdjudicatorDecision(
            verdict="revise",
            revision_plan=plan,
            weighted_composite=composite,
            delta=delta,
            dynamic_budget=budget,
            early_stop=False,
        )
    }

def route_decision(state: GraphState):
    decision = state.get("decision")
    if isinstance(decision, dict):
        try:
            decision = AdjudicatorDecision(**decision)
            state["decision"] = decision
        except Exception:
            pass

    revision_count = state.get("revision_count", 0)
    gen_mode = str(state.get("generation_mode") or state.get("mode") or "QUICK").upper()
    
    # Dynamic budget resolution
    max_revisions = None
    if decision and getattr(decision, "dynamic_budget", None) is not None:
        try:
            budget_val = int(decision.dynamic_budget)
            if budget_val > 0:
                max_revisions = budget_val
        except (ValueError, TypeError):
            pass

    if max_revisions is None:
        max_revisions = 2 if gen_mode == "QUICK" else 3
    
    verdict = decision.verdict.upper() if decision and getattr(decision, "verdict", None) else "UNKNOWN"
    print(f"Adjudicator Verdict: {verdict} (Revision: {revision_count}/{max_revisions}, Mode: {gen_mode})")
    
    verdict_lower = decision.verdict.lower() if decision and getattr(decision, "verdict", None) else ""

    if verdict_lower == "error":
        return END

    if verdict_lower == "pass" or revision_count >= max_revisions:
        if gen_mode == "QUICK" and revision_count >= max_revisions and verdict_lower != "pass":
            print(f"[QUICK MODE] Component exceeded {max_revisions} revisions. Forcing proceed.")
            if decision:
                decision.verdict = "pass"
                decision.revision_plan = f"Forced proceed after {max_revisions} revisions in QUICK mode."
            else:
                state["decision"] = AdjudicatorDecision(verdict="pass", revision_plan=f"Forced proceed after {max_revisions} revisions in QUICK mode.")
        return END
    else:
        # In a fully autonomous loop, this would route to a 'node_codegen_revise'
        # For our FastAPI setup, we return END so the backend can pause and return the revision plan to the UI.
        return END


def build_arbitration_graph():
    """Builds the LangGraph that runs critics in parallel and funnels them to the Adjudicator."""
    workflow = StateGraph(GraphState)

    # 1. Add all nodes
    workflow.add_node("start", lambda state: state) # Dummy node to fan out
    workflow.add_node("correctness", node_correctness)
    workflow.add_node("architecture", node_architecture)
    workflow.add_node("completeness", node_completeness)
    workflow.add_node("adjudicator", node_adjudicator)

    # 2. Fan-out from start to all three critics
    workflow.set_entry_point("start")
    workflow.add_edge("start", "correctness")
    workflow.add_edge("start", "architecture")
    workflow.add_edge("start", "completeness")

    # 3. Fan-in from all three critics to the Adjudicator
    workflow.add_edge("correctness", "adjudicator")
    workflow.add_edge("architecture", "adjudicator")
    workflow.add_edge("completeness", "adjudicator")

    # 4. Conditional Edge from Adjudicator
    workflow.add_conditional_edges("adjudicator", route_decision)

    return workflow.compile()

# Instantiate the compiled graph
arbitration_engine = build_arbitration_graph()
