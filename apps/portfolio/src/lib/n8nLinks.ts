import { resolveN8n } from "./n8n";

// معرّفات الـ workflows والمشروع في خادم n8n الخاص بصاحب الموقع (تُستعمل لروابط الفتح المباشر في لوحة التحكم)
export const N8N_IDS = {
  dashboardWorkflow: "CkNNYICjLShIs9k7",
  autoReplyWorkflow: "A3nq2aTBFgpF4JCq",
  project: "NXiVEPvIE28h3Eku",
} as const;

export const META_APPS_URL = "https://developers.facebook.com/apps/";
export const WA_CLOUD_DOC_URL = "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started";

export type N8nLinks = {
  dashboardWorkflow: string;
  autoReplyWorkflow: string;
  dataTables: string;
  credentials: string;
};

/** روابط فتح مباشرة داخل n8n؛ null إن لم يُضبط عنوان الخادم */
export function n8nLinks(base: string = resolveN8n().baseUrl): N8nLinks | null {
  const b = base.trim().replace(/\/+$/, "");
  if (!b) return null;
  return {
    dashboardWorkflow: `${b}/workflow/${N8N_IDS.dashboardWorkflow}`,
    autoReplyWorkflow: `${b}/workflow/${N8N_IDS.autoReplyWorkflow}`,
    dataTables: `${b}/projects/${N8N_IDS.project}/datatables`,
    credentials: `${b}/home/credentials`,
  };
}
