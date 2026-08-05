from typing import Iterator
from langchain_core.documents import Document
from langchain_core.language_models.chat_models import BaseChatModel
from app.prompts.rag_prompt import rag_answer_prompt
from app.core.llm import llm


class ChatChain:

    def __init__(
        self,
        llm: BaseChatModel,
    ):
        self.chain = rag_answer_prompt | llm

    def invoke(
        self,
        context: list[Document],
        question: str,
    ):

        return self.chain.invoke(
            {
                "context": context,
                "question": question,
            }
        )

    def stream(
        self,
        context: list[Document],
        question: str,
    ) -> Iterator:
        """Token-level streaming generator for RAG chat answers."""

        return self.chain.stream(
            {
                "context": context,
                "question": question,
            }
        )


ChatChain_service = ChatChain(llm=llm)
