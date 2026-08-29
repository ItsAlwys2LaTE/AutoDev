class PromptGuardError(ValueError):
    pass

def validate_prompt(prompt: str) -> None:
    if not prompt or not isinstance(prompt, str):
        raise PromptGuardError("Prompt cannot be empty.")
        
    prompt_clean = prompt.strip()
    
    if len(prompt_clean) < 10:
        raise PromptGuardError("Prompt is too short. Please provide at least a 10-character description of what you want to build.")
    
    word_count = len(prompt_clean.split())
    if word_count < 3:
        raise PromptGuardError("Prompt is too vague. Please use at least 3 words to describe your feature.")
        
    # Basic Prompt Injection heuristics
    lower = prompt_clean.lower()
    injection_patterns = [
        "ignore all previous",
        "ignore previous",
        "bypass",
        "you are now a",
        "system prompt",
        "disregard instructions",
        "forget all",
        "developer mode"
    ]
    
    for pattern in injection_patterns:
        if pattern in lower:
            raise PromptGuardError(f"Security Alert: Blocked potential prompt injection attempt (detected '{pattern}').")
            
    return True
