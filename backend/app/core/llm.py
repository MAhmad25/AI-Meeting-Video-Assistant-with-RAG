import os
from typing import cast
from pydantic import SecretStr
from langchain_openai import ChatOpenAI

# llm = ChatOpenAI(
#     model="moonshotai/kimi-k3-free",
#     api_key=cast(SecretStr, os.getenv("TOKENROUTER_API_KEY")),
#     base_url="https://api.tokenrouter.com/v1",
#     temperature=0,
# )
llm = ChatOpenAI(
    model="qwen2.5:3b",
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # type: ignore
)
# llm = ChatOpenAI(
#     model="openrouter/free",
#     api_key=cast(SecretStr, os.getenv("OPENROUTER_API_KEY")),
#     base_url="https://openrouter.ai/api/v1",
# )
