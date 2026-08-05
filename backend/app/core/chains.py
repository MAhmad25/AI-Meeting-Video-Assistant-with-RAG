from .llm import llm

from app.chains.map_chain import MapChain
from app.chains.reduce_chain import ReduceChain

from app.prompts.meetings.map_prompt import meeting_map_prompt
from app.prompts.meetings.reduce_prompt import meeting_reduce_prompt

from app.prompts.youtube.map_prompt import youtube_map_prompt
from app.prompts.youtube.reduce_prompt import youtube_reduce_prompt

from app.schemas.meeting import MeetingChunkAnalysis, MeetingReport

from app.schemas.youtube import YoutubeChunkAnalysis, YoutubeReport


youtube_map_chain = MapChain(youtube_map_prompt, llm, YoutubeChunkAnalysis)
youtube_reduce_chain = ReduceChain(youtube_reduce_prompt, llm, YoutubeReport)

meeting_map_chain = MapChain(meeting_map_prompt, llm, MeetingChunkAnalysis)
meeting_reduce_chain = ReduceChain(meeting_reduce_prompt, llm, MeetingReport)
