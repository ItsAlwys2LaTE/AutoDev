from typing import TypedDict, Annotated, List
import operator
import os
import json
from langgraph.graph import StateGraph, END
from google import genai
from google.genai import types

from models import RequirementsDocument, SystemDesignBlueprint, GeneratedCodeBase, ExecutionResult, CriticFeedback, AdjudicatorDecision
from agents.critics import evaluate_correctness, evaluate_architecture, evaluate_completeness

class GraphState(TypedDict):
    requirements: RequirementsDocument
    blueprint: SystemDesignBlueprint
    codebase: GeneratedCodeBase
    execution_result: ExecutionResult
    # operator.add ensures that when parallel nodes return lists, they are concatenated together
    feedbacks: Annotated[List[CriticFeedback], operator.add]
    decision: AdjudicatorDecision
    revision_count: int

def node_correctness(state: GraphState):
    feedback = evaluate_correctness(state["requirements"], state["execution_result"])
    return {"feedbacks": [feedback]}

def node_architecture(state: GraphState):
    feedback = evaluate_architecture(state["blueprint"], state["codebase"])
    return {"feedbacks": [feedback]}

def node_completeness(state: GraphState):
    feedback = evaluate_completeness(state["requirements"], state["codebase"])
    return {"feedbacks": [feedback]}

def node_adjudicator(state: GraphState):
    print("Running Adjudicator (Gemini 3.6-flash)...")
    api_key = os.environ.get("GEMINI_API_KEY_CRITICS") or os.environ.get("GEMINI_API_KEY_CODEGEN")
    
    if not api_key:
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
    
    client = genai.Client(api_key=api_key)
    system_instruction = "You are the Adjudicator. Output strict JSON containing 'verdict' (pass/revise/error) and 'revision_plan'."

    try:
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
            decision = response.parsed
        else:
            decision = AdjudicatorDecision.model_validate_json(response.text)
        return {"decision": decision}
    except Exception as e:
        print(f"Adjudicator failed: {e}")
        return {"decision": AdjudicatorDecision(verdict="error", revision_plan=f"Adjudicator Error: {str(e)}")}

def route_decision(state: GraphState):
    decision = state.get("decision")
    revision_count = state.get("revision_count", 0)
    
    print(f"Adjudicator Verdict: {decision.verdict.upper()} (Revision: {revision_count}/3)")
    
    if decision.verdict.lower() == "pass" or revision_count >= 3:
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
