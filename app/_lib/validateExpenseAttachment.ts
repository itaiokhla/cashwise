// app/_lib/validateExpenseAttachment.ts

/**
 * Standard user-facing message when no attachment is provided.
 */
export const ATTACHMENT_REQUIRED_MESSAGE =
  "Please upload at least one attachment (Location, Payment, or Invoice) before submitting the expense.";

/**
 * Result structure returned by server-side attachment validation.
 */
export interface AttachmentValidationResult {
  valid: boolean;
  hasLocation: boolean;
  hasPayment: boolean;
  hasInvoice: boolean;
  totalAttachments: number;
  locationFiles: string[];
  paymentFiles: string[];
  invoiceFiles: string[];
  message?: string;
}

/**
 * Server-side validation for expense attachments in FormData.
 * Checks that at least ONE attachment option (Location, Payment, or Invoice)
 * contains at least one non-empty string URL.
 */
export function validateExpenseAttachments(
  formData: FormData
): AttachmentValidationResult {
  const extractCleanUrls = (fieldNames: string[]): string[] => {
    const urls: string[] = [];
    for (const name of fieldNames) {
      const entries = formData.getAll(name);
      for (const entry of entries) {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          if (trimmed.length > 0) {
            urls.push(trimmed);
          }
        } else if (
          entry &&
          typeof entry === "object" &&
          "name" in entry &&
          (entry as File).size > 0
        ) {
          // In case a File object was passed
          urls.push((entry as File).name);
        }
      }
    }
    return urls;
  };

  const locationFiles = extractCleanUrls(["Location", "locationFiles"]);
  const paymentFiles = extractCleanUrls(["Payment", "paymentFiles"]);
  const invoiceFiles = extractCleanUrls(["Invoice", "invoiceFiles"]);

  const hasLocation = locationFiles.length > 0;
  const hasPayment = paymentFiles.length > 0;
  const hasInvoice = invoiceFiles.length > 0;

  const valid = hasLocation || hasPayment || hasInvoice;

  return {
    valid,
    hasLocation,
    hasPayment,
    hasInvoice,
    totalAttachments:
      locationFiles.length + paymentFiles.length + invoiceFiles.length,
    locationFiles,
    paymentFiles,
    invoiceFiles,
    message: valid ? undefined : ATTACHMENT_REQUIRED_MESSAGE,
  };
}

/**
 * Client-side validation for Redux files state.
 * Checks that at least ONE attachment option (Location, Payment, or Invoice)
 * contains at least one uploaded file URL.
 */
export function hasAtLeastOneAttachment(
  files: Record<string, string[]> | undefined | null
): boolean {
  if (!files || typeof files !== "object") {
    return false;
  }

  const checkCategory = (categoryName: string): boolean => {
    const fileList = files[categoryName];
    return (
      Array.isArray(fileList) &&
      fileList.some(
        (url) => typeof url === "string" && url.trim().length > 0
      )
    );
  };

  const hasLocation = checkCategory("Location");
  const hasPayment = checkCategory("Payment");
  const hasInvoice = checkCategory("Invoice");

  return hasLocation || hasPayment || hasInvoice;
}
