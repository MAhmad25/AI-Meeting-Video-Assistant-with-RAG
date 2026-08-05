from app.core.vectorstore import vector_store


class RetrieverService:

    def retrieve(
        self,
        query: str,
        source_id: str,
        k: int = 10,
    ):

        retriever = vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": k,
                "fetch_k": 20,
                "lambda_mult": 0.5,
                "filter": {
                    "id": source_id,
                },
            },
        )

        return retriever.invoke(query)


retriever_service = RetrieverService()
