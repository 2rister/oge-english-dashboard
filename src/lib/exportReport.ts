import type { ReportData } from "./reportData";

type ExportPayload = {
  generatedAt: string;
  reports: ReportData["reports"];
  groups: ReportData["groups"];
  query: string;
};

export function downloadReportHtml(payload: ExportPayload) {
  submitDownloadForm("html", payload.query);
}

export async function downloadReportPdf(payload: ExportPayload) {
  submitDownloadForm("pdf", payload.query);
}

function buildExportUrl(format: "pdf" | "html", query: string) {
  const base = `${window.location.protocol}//${window.location.hostname}:8092/download-report`;
  const params = new URLSearchParams({ format });

  if (query.trim()) {
    params.set("q", query.trim());
  }

  return `${base}?${params.toString()}`;
}

function submitDownloadForm(format: "pdf" | "html", query: string) {
  const frameName = "report-download-frame";
  let frame = document.getElementById(frameName) as HTMLIFrameElement | null;

  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = frameName;
    frame.name = frameName;
    frame.style.display = "none";
    document.body.appendChild(frame);
  }

  const form = document.createElement("form");
  form.method = "GET";
  form.action = `${window.location.protocol}//${window.location.hostname}:8092/download-report`;
  form.target = frameName;
  form.style.display = "none";

  const formatInput = document.createElement("input");
  formatInput.type = "hidden";
  formatInput.name = "format";
  formatInput.value = format;
  form.appendChild(formatInput);

  if (query.trim()) {
    const queryInput = document.createElement("input");
    queryInput.type = "hidden";
    queryInput.name = "q";
    queryInput.value = query.trim();
    form.appendChild(queryInput);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}
