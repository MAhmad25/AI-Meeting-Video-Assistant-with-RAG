from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, Type, cast
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel
from rich import print


ProgressEmitter = Callable[[int, int], None]

# How many chunks to analyze concurrently. Kept modest rather than unbounded
# because free-tier LLM endpoints often rate-limit on concurrent requests;
# raise this if your provider comfortably supports more parallel calls.
DEFAULT_MAX_WORKERS = 4


class MapChain:
    """MapChain is a class that represents a mapping chain for processing transcript chunks. It takes a prompt, a language model (LLM), and a schema as input. The chain is constructed by combining the prompt with the LLM, which is configured to produce structured output based on the provided schema. The `invoke` method allows users to process a transcript chunk by passing it to the chain, which returns the structured analysis according to the specified schema."""

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

    def batch(
        self,
        chunks: list[str],
        emit: ProgressEmitter | None = None,
        max_workers: int = DEFAULT_MAX_WORKERS,
    ) -> list[BaseModel]:
        total = len(chunks)
        if total == 0:
            return []

        results: dict[int, BaseModel] = {}
        completed = 0
        print(f"Processing {total} chunks")
        
        # Chunks run concurrently (this is what the CLI's native .batch() was
        # doing), but progress is still reported per completion so the UI
        # keeps getting "N/total" updates as each one finishes — just in
        # completion order rather than input order.
        with ThreadPoolExecutor(max_workers=min(max_workers, total)) as executor:
            future_to_index = {
                executor.submit(self.chain.invoke, {"transcript": chunk}): i
                for i, chunk in enumerate(chunks)
            }
            for future in as_completed(future_to_index):
                index = future_to_index[future]
                results[index] = future.result()
                print(f"Result: {results[index]}")
                completed += 1
                if emit:
                    emit(completed, total)

        return cast(list[BaseModel], [results[i] for i in range(total)])
