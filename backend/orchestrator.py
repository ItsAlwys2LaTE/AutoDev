from typing import TypedDict, Annotated, List, Optional
import operator
import os
import json
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

def node_correctness(state: GraphState):
    feedback = evaluate_correctness(state["requirements"], state["execution_result"])
    return {"feedbacks": [feedback]}

def node_architecture(state: GraphState):
    feedback = evaluate_architecture(state["blueprint"], state["codebase"], state.get("master_decomposition"))
    return {"feedbacks": [feedback]}

def node_completeness(state: GraphState):
    feedback = evaluate_completeness(state["requirements"], state["blueprint"], state["codebase"], state.get("master_decomposition"))
    return {"feedbacks": [feedback]}

from key_balancer import get_gemini_keys_for_stage, is_rate_limit_error

def node_adjudicator(state: GraphState):
    print("Running Adjudicator (Gemini 3.6-flash)...")
    primary_key = os.environ.get("GEMINI_API_KEY_ADJUDICATOR") or os.environ.get("GEMINI_API_KEY_CRITICS") or os.environ.get("GEMINI_API_KEY_CODEGEN")
    keys = get_gemini_keys_for_stage("ADJUDICATOR")
    if primary_key and primary_key.strip() and primary_key.strip() not in keys:
        keys = [primary_key.strip()] + keys
    
    if not keys:
        return {"decision": AdjudicatorDecision(verdict="revise", revision_plan="API Key Missing for Adjudicator.")}

    # Convert the pydantic feedback objects to JSON strings for the prompt
    feedbacks_json = [f.model_dump() for f in state["feedbacks"]]
    
    prompt = f"""
    You are the Chief Software Adjudicator. 
    Review the feedbacks provided by the 3 independent critic agents:
    {json.dumps(feedbacks_json, indent=2)}
    
    INSTRUCTIONS:
    1. SYSTEM ERRORS: If ANY critic feedback mentions an "API Error", "Rate Limit", or system failure, you MUST output a verdict of 'error' and set the revision_plan to explain that the evaluation failed due to a system error. DO NOT tell the CodeGen agent to revise the code.
    2. CODE ISSUES: If there are no system errors, and ANY critic gave a severity_score greater than 0, you MUST output a verdict of 'revise', and synthesize their issues into a clear, actionable 'revision_plan' for the CodeGen agent.
    3. PASS: If all severity scores are 0, output a verdict of 'pass' and a brief approval message.
    """
    
    system_instruction = "You are the Adjudicator. Output strict JSON containing 'verdict' (pass/revise/error) and 'revision_plan'."

    for idx, key in enumerate(keys):
        client = genai.Client(api_key=key)

        @with_exponential_backoff
        def _call_primary():
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1,
                    response_mime_type="application/json",
                    response_schema=AdjudicatorDecision,
                )
            )
            if hasattr(response, 'parsed') and response.parsed is not None:
                return response.parsed
            else:
                return AdjudicatorDecision.model_validate_json(response.text)

        try:
            decision = _call_primary()
            return {"decision": decision}
        except Exception as e:
            print(f"Adjudicator primary model failed on key {idx+1}/{len(keys)}: {e}")
            if is_rate_limit_error(e) and idx + 1 < len(keys):
                print(f"Rate limit hit on key {idx+1}. Rotating to next available primary key ({idx+2}/{len(keys)}) on gemini-3.6-flash...")
                continue
            else:
                print("Falling back to gemini-3.5-flash-lite in Adjudicator...")
                for fb_idx, fb_key in enumerate(keys):
                    fb_client = genai.Client(api_key=fb_key)

                    @with_exponential_backoff
                    def _call_fallback():
                        response = fb_client.models.generate_content(
                            model="gemini-3.5-flash-lite",
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction,
                                temperature=0.1,
                                response_mime_type="application/json",
                                response_schema=AdjudicatorDecision,
                            )
                        )
                        if hasattr(response, 'parsed') and response.parsed is not None:
                            return response.parsed
                        else:
                            return AdjudicatorDecision.model_validate_json(response.text)

                    try:
                        decision = _call_fallback()
                        return {"decision": decision}
                    except Exception as fallback_e:
                        print(f"Adjudicator fallback failed on key {fb_idx+1}: {fallback_e}")
                        if fb_idx + 1 < len(keys):
                            continue
                        return {"decision": AdjudicatorDecision(verdict="error", revision_plan=f"Adjudicator Error: {str(fallback_e)}")}

def route_decision(state: GraphState):
    decision = state.get("decision")
    revision_count = state.get("revision_count", 0)
    gen_mode = str(state.get("generation_mode") or state.get("mode") or "QUICK").upper()
    max_revisions = 1 if gen_mode == "QUICK" else 3
    
    verdict = decision.verdict.upper() if decision and getattr(decision, "verdict", None) else "UNKNOWN"
    print(f"Adjudicator Verdict: {verdict} (Revision: {revision_count}/{max_revisions}, Mode: {gen_mode})")
    
    verdict_lower = decision.verdict.lower() if decision and getattr(decision, "verdict", None) else ""
    if verdict_lower == "pass" or revision_count >= max_revisions:
        if gen_mode == "QUICK" and revision_count >= max_revisions and verdict_lower != "pass":
            print(f"[QUICK MODE] Component exceeded {max_revisions} revisions. Forcing proceed.")
            if decision:
                decision.verdict = "pass"
                decision.revision_plan = f"Forced proceed after {max_revisions} revisions in QUICK mode."
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
