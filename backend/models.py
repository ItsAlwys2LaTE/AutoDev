from pydantic import BaseModel, Field
from typing import List

class AcceptanceCriteria(BaseModel):
    """Specific conditions that a software feature must satisfy to be accepted."""
    id: str = Field(description="A unique identifier for the AC, e.g., AC-1")
    description: str = Field(description="Clear, testable description of the condition")
    expected_behavior: str = Field(description="What the system should do if the condition is met")

class UserStory(BaseModel):
    """A single user story representing a piece of functionality."""
    title: str = Field(description="Short title of the feature")
    as_a: str = Field(description="The user persona (e.g., 'As a regular user')")
    i_want_to: str = Field(description="The action the user wants to perform")
    so_that: str = Field(description="The benefit or value of the action")
    acceptance_criteria: List[AcceptanceCriteria] = Field(description="List of acceptance criteria for this story")

class RequirementsDocument(BaseModel):
    """The final structured output from the Requirements Agent."""
    project_title: str = Field(description="Inferred title of the project/feature")
    overview: str = Field(description="Brief summary of what is being built")
    user_stories: List[UserStory] = Field(description="All user stories required to build the feature")