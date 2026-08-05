from pydantic import BaseModel, Field


class GlossaryItem(BaseModel):
    term: str
    definition: str


class YoutubeChunkAnalysis(BaseModel):
    """
    Analysis of a single transcript chunk.
    """

    summary: str = Field(
        description="Summary of this chunk."
    )

    topics: list[str] = Field(
        default_factory=list
    )

    concepts: list[str] = Field(
        default_factory=list
    )

    tools: list[str] = Field(
        default_factory=list
    )

    examples: list[str] = Field(
        default_factory=list
    )

    resources: list[str] = Field(
        default_factory=list
    )

    best_practices: list[str] = Field(
        default_factory=list
    )

    mistakes: list[str] = Field(
        default_factory=list
    )


class YoutubeReport(BaseModel):
    """
    Final report generated from the entire video.
    """

    title: str

    overview: str

    learning_objectives: list[str]

    topics_covered: list[str]

    step_by_step_explanation: list[str]

    tools_mentioned: list[str]

    important_concepts: list[str]

    best_practices: list[str]

    mistakes_to_avoid: list[str]

    resources_mentioned: list[str]

    key_takeaways: list[str]

    glossary: list[GlossaryItem]

    quiz_questions: list[str]

    interview_questions: list[str]

    final_summary: str
