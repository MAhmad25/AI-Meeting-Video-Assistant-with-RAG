from app.chains.report_chain import ReportChain
from app.core.chains import youtube_map_chain, youtube_reduce_chain

youtube_report_chain = ReportChain(
    map_chain=youtube_map_chain,
    reduce_chain=youtube_reduce_chain
)
