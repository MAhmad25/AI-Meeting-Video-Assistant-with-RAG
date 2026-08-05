from typing import Type
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel


class ReduceChain:
    """
    Combines multiple chunk analyses into one final report.
    """

    def __init__(
        self,
        prompt: ChatPromptTemplate,
        llm: BaseChatModel,
        schema: Type[BaseModel],
    ):
        self.chain = (
            prompt
            | llm.with_structured_output(schema)
        )

    def invoke(self, analyses: list[BaseModel]):
        """
        analyses:
            List[MeetingChunkAnalysis]
            or
            List[YoutubeChunkAnalysis]
        """

        return self.chain.invoke(
            {
                "analyses": analyses
            }
        )
