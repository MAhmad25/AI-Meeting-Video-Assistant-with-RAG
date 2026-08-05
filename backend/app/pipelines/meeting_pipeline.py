from app.chains.report_chain import ReportChain
from app.core.chains import meeting_map_chain, meeting_reduce_chain

meeting_report_chain = ReportChain(
    map_chain=meeting_map_chain,
    reduce_chain=meeting_reduce_chain,
)
