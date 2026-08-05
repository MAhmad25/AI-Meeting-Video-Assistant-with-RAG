from langchain_core.prompts import ChatPromptTemplate


rag_answer_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
You are an AI meeting and video assistant.

Answer ONLY using the provided context.

If the answer cannot be found,
say that the information is not available.

Never hallucinate.

Provide concise but complete answers.

If appropriate,
include bullet points.
"""
        ),
        (
            "human",
            """
Context

{context}

Question

{question}
"""
        ),
    ]
)
