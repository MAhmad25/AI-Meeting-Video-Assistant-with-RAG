from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_transcript(transcript: str) -> list[str]:
    """
    Split the transcript into chunks of text for further processing.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=3000,
        chunk_overlap=300,
        separators=[
            "\n\n",
            "\n",
            ". ",
            " ",
        ],
    )
    return splitter.split_text(transcript)
