/** واجهة الربط مع SAP/ERP — توقيعات جاهزة وتنفيذ وهمي لسهولة الربط لاحقًا */
export interface MaterialMovement { materialCode: string; movementType: "GI" | "GR" | "RETURN"; quantity: number; unit: string; workOrder: string; postedAt: string; document?: string }
export interface InvoicePayload { workOrder: string; invoiceNo: string; contractor: string; grossAmount: number; netPayable: number; currency: "SAR"; lines: { code: string; description: string; qty: number; rate: number; amount: number }[] }
export interface ErpAdapter {
  readonly name: string;
  /** حركة المواد من المستودع (SAP MIGO/DDO) لأمر عمل ضمن فترة */
  fetchMaterialMovements(workOrder: string, range?: { from?: string; to?: string }): Promise<MaterialMovement[]>;
  /** دفع المستخلص إلى النظام المحاسبي */
  pushInvoice(invoice: InvoicePayload): Promise<{ accepted: boolean; reference?: string; error?: string }>;
}
/** تنفيذ وهمي: لا يتصل بأي نظام. استبدله بتنفيذ SAP OData/RFC. */
export class MockErpAdapter implements ErpAdapter {
  readonly name = "mock";
  async fetchMaterialMovements(): Promise<MaterialMovement[]> { return []; }
  async pushInvoice(invoice: InvoicePayload) { return { accepted: true, reference: "MOCK-" + invoice.invoiceNo }; }
}
export const createErpAdapter = (): ErpAdapter => new MockErpAdapter();
