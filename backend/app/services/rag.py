from uuid import uuid4
from langchain_core.documents import Document
from app.core.vectorstore import vector_store
from app.services.transcript_chunking import chunk_transcript


class RAGService:

    def index_transcript(
        self,
        transcript: str,
        source_type: str,
        source_id: str,
        title: str,
    ):

        chunks = chunk_transcript(transcript)

        documents = []

        for index, chunk in enumerate(chunks):

            documents.append(
                Document(
                    page_content=chunk,
                    metadata={
                        "id": source_id,
                        "title": title,
                        "type": source_type,
                        "chunk": index,
                    },
                )
            )

        vector_store.add_documents(
            documents=documents,
            ids=[str(uuid4()) for _ in documents],
        )


rag_service = RAGService()
