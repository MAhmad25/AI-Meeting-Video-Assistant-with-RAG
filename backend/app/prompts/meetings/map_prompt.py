from langchain_core.prompts import ChatPromptTemplate

meeting_map_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
You are an expert meeting analyst.

Analyze ONLY the transcript chunk.

Extract the following information.

Return STRICT JSON.

{{
  "summary": "...",
  "topics": [],
  "decisions": [],
  "action_items": [],
  "questions": [],
  "risks": [],
  "deadlines": [],
  "important_points": []
}}

Do not invent information.

If something is not mentioned, return an empty list.

Your response MUST match the MeetingChunkAnalysis schema.
""",
        ),
        (
            "human",
            "{transcript}"
        ),
    ]
)
