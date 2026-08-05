from langchain_core.embeddings import Embeddings
from langchain_ollama import OllamaEmbeddings


def get_embeddings() -> Embeddings:
    """
    Returns the embedding model.

    Development:
        nomic-embed-text

    Production:
        Replace with MistralAIEmbeddings.
    """

    return OllamaEmbeddings(
        model="nomic-embed-text",
    )
