from langchain_core.prompts import ChatPromptTemplate

meeting_reduce_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
You are an AI Meeting Assistant.

You are given structured summaries from many transcript chunks.

Merge everything.

Remove duplicates.

Combine related ideas.

Generate a complete meeting report covering:

- Title
- Executive Summary
- Meeting Purpose
- Discussion Topics
- Key Decisions
- Action Items
- Open Questions
- Risks and Blockers
- Deadlines
- Follow Up Items
- Key Takeaways
- Next Meeting
- Keywords
- Timeline
- Final Conclusion

Your response MUST match the MeetingReport schema.

Never invent information that is not supported by the transcript.
"""
        ),
        (
            "human",
            """
Chunk Analyses

{analyses}
"""
        ),
    ]
)
