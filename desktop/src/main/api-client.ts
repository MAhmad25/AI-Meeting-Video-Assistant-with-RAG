import { BACKEND_BASE_URL } from "./constants";
import type { CreateMeetingJobRequest, CreateYoutubeJobRequest, JobCreateResponse, JobStatusResponse, Report, SavedReportDetail, SavedReportSummary } from "@shared/types";

class ApiError extends Error {
      constructor(
            message: string,
            public status: number,
      ) {
            super(message);
            this.name = "ApiError";
      }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
      const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
            headers: { "Content-Type": "application/json" },
            ...init,
      });

      if (!res.ok) {
            let detail = res.statusText;
            try {
                  const body = await res.json();
                  detail = body?.detail ?? detail;
            } catch {
                  /* response wasn't JSON — keep statusText */
            }
            throw new ApiError(detail, res.status);
      }

      // DELETE /jobs/{id} and similar can return small non-typed bodies too.
      return (await res.json()) as T;
}

export const apiClient = {
      createYoutubeJob(payload: CreateYoutubeJobRequest) {
            return request<JobCreateResponse>("/youtube/jobs", {
                  method: "POST",
                  body: JSON.stringify(payload),
            });
      },

      createMeetingJob(payload: CreateMeetingJobRequest) {
            return request<JobCreateResponse>("/meeting/jobs", {
                  method: "POST",
                  body: JSON.stringify(payload),
            });
      },

      getJobStatus(jobId: string) {
            return request<JobStatusResponse>(`/jobs/${jobId}`);
      },

      getJobReport(jobId: string) {
            return request<Report>(`/jobs/${jobId}/report`);
      },

      deleteJob(jobId: string) {
            return request<{ deleted: boolean }>(`/jobs/${jobId}`, { method: "DELETE" });
      },

      listReports() {
            return request<SavedReportSummary[]>("/reports");
      },

      getSavedReport(reportId: string) {
            return request<SavedReportDetail>(`/reports/${reportId}`);
      },
};

export { ApiError };
