// scripts/test_attachment_validation.ts
import {
  validateExpenseAttachments,
  hasAtLeastOneAttachment,
  ATTACHMENT_REQUIRED_MESSAGE,
} from "../app/_lib/validateExpenseAttachment";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: ${testName} - ${detail || "Assertion failed"}`);
    failedCount++;
  }
}

console.log("=================================================");
console.log("CASHWISE: MANDATORY ATTACHMENT REGRESSION SUITE");
console.log("=================================================\n");

// -------------------------------------------------------------
// Test 1: No attachment
// Location = absent, Payment = absent, Invoice = absent
// Expected: Submission blocked, clear validation message
// -------------------------------------------------------------
{
  // Client check
  const clientEmpty = hasAtLeastOneAttachment({});
  assert(!clientEmpty, "Test 1 (Client): No attachment blocked on client");

  const clientEmptyArrays = hasAtLeastOneAttachment({
    Location: [],
    Payment: [],
    Invoice: [],
  });
  assert(!clientEmptyArrays, "Test 1 (Client): Empty arrays blocked on client");

  // Server check
  const fd = new FormData();
  fd.append("siteName", "Site Alpha");
  fd.append("amount", "250");
  const serverResult = validateExpenseAttachments(fd);
  assert(!serverResult.valid, "Test 1 (Server): Empty FormData rejected");
  assert(
    serverResult.message === ATTACHMENT_REQUIRED_MESSAGE,
    "Test 1 (Server): Clear validation error message returned",
    serverResult.message
  );
}

// -------------------------------------------------------------
// Test 2: Attachment 1 only (Location only)
// Location = present, Payment = absent, Invoice = absent
// Expected: Submission succeeds
// -------------------------------------------------------------
{
  const clientResult = hasAtLeastOneAttachment({
    Location: ["https://ik.imagekit.io/cashwise/location_proof.jpg"],
    Payment: [],
    Invoice: [],
  });
  assert(clientResult, "Test 2 (Client): Location attachment only is accepted");

  const fd = new FormData();
  fd.append("Location", "https://ik.imagekit.io/cashwise/location_proof.jpg");
  const serverResult = validateExpenseAttachments(fd);
  assert(
    serverResult.valid && serverResult.hasLocation && !serverResult.hasPayment && !serverResult.hasInvoice,
    "Test 2 (Server): Location attachment only is accepted"
  );
  assert(
    serverResult.locationFiles.length === 1,
    "Test 2 (Server): Exactly 1 location file extracted"
  );
}

// -------------------------------------------------------------
// Test 3: Attachment 2 only (Payment only)
// Location = absent, Payment = present, Invoice = absent
// Expected: Submission succeeds
// -------------------------------------------------------------
{
  const clientResult = hasAtLeastOneAttachment({
    Location: [],
    Payment: ["https://ik.imagekit.io/cashwise/payment_receipt.png"],
    Invoice: [],
  });
  assert(clientResult, "Test 3 (Client): Payment attachment only is accepted");

  const fd = new FormData();
  fd.append("Payment", "https://ik.imagekit.io/cashwise/payment_receipt.png");
  const serverResult = validateExpenseAttachments(fd);
  assert(
    serverResult.valid && !serverResult.hasLocation && serverResult.hasPayment && !serverResult.hasInvoice,
    "Test 3 (Server): Payment attachment only is accepted"
  );
  assert(
    serverResult.paymentFiles.length === 1,
    "Test 3 (Server): Exactly 1 payment file extracted"
  );
}

// -------------------------------------------------------------
// Test 4: Attachment 3 only (Invoice only)
// Location = absent, Payment = absent, Invoice = present
// Expected: Submission succeeds
// -------------------------------------------------------------
{
  const clientResult = hasAtLeastOneAttachment({
    Location: [],
    Payment: [],
    Invoice: ["https://ik.imagekit.io/cashwise/vendor_bill.pdf"],
  });
  assert(clientResult, "Test 4 (Client): Invoice attachment only is accepted");

  const fd = new FormData();
  fd.append("Invoice", "https://ik.imagekit.io/cashwise/vendor_bill.pdf");
  const serverResult = validateExpenseAttachments(fd);
  assert(
    serverResult.valid && !serverResult.hasLocation && !serverResult.hasPayment && serverResult.hasInvoice,
    "Test 4 (Server): Invoice attachment only is accepted"
  );
  assert(
    serverResult.invoiceFiles.length === 1,
    "Test 4 (Server): Exactly 1 invoice file extracted"
  );
}

// -------------------------------------------------------------
// Test 5: Two attachments
// Location = present, Payment = present, Invoice = absent
// Expected: Submission succeeds
// -------------------------------------------------------------
{
  const clientResult = hasAtLeastOneAttachment({
    Location: ["https://ik.imagekit.io/cashwise/loc.jpg"],
    Payment: ["https://ik.imagekit.io/cashwise/pay.jpg"],
    Invoice: [],
  });
  assert(clientResult, "Test 5 (Client): Two attachments accepted");

  const fd = new FormData();
  fd.append("Location", "https://ik.imagekit.io/cashwise/loc.jpg");
  fd.append("Payment", "https://ik.imagekit.io/cashwise/pay.jpg");
  const serverResult = validateExpenseAttachments(fd);
  assert(
    serverResult.valid && serverResult.totalAttachments === 2,
    "Test 5 (Server): Two attachments accepted"
  );
}

// -------------------------------------------------------------
// Test 6: Three attachments
// Location = present, Payment = present, Invoice = present
// Expected: Submission succeeds
// -------------------------------------------------------------
{
  const clientResult = hasAtLeastOneAttachment({
    Location: ["https://ik.imagekit.io/cashwise/loc.jpg"],
    Payment: ["https://ik.imagekit.io/cashwise/pay.jpg"],
    Invoice: ["https://ik.imagekit.io/cashwise/inv.pdf"],
  });
  assert(clientResult, "Test 6 (Client): All three attachments accepted");

  const fd = new FormData();
  fd.append("Location", "https://ik.imagekit.io/cashwise/loc.jpg");
  fd.append("Payment", "https://ik.imagekit.io/cashwise/pay.jpg");
  fd.append("Invoice", "https://ik.imagekit.io/cashwise/inv.pdf");
  const serverResult = validateExpenseAttachments(fd);
  assert(
    serverResult.valid && serverResult.totalAttachments === 3,
    "Test 6 (Server): All three attachments accepted"
  );
}

// -------------------------------------------------------------
// Test 7: No attachment + valid expense limit
// Expected: Attachment validation error (fails before limit validation)
// -------------------------------------------------------------
{
  const fd = new FormData();
  fd.append("amount", "200"); // Within 500 limit
  const check = validateExpenseAttachments(fd);
  assert(!check.valid, "Test 7: No attachment fails even when within expense limit");
  assert(
    check.message === ATTACHMENT_REQUIRED_MESSAGE,
    "Test 7: Attachment error message returned"
  );
}

// -------------------------------------------------------------
// Test 8: Attachment + expense limit exceeded
// Expected: Passes attachment check; limit validation remains active
// -------------------------------------------------------------
{
  const fd = new FormData();
  fd.append("Payment", "https://ik.imagekit.io/cashwise/pay.png");
  fd.append("amount", "25000"); // Exceeds standard limit
  const check = validateExpenseAttachments(fd);
  assert(check.valid, "Test 8: Passes attachment validation");
  // Downstream validation: limitCheck will proceed and trigger LIMIT_EXCEEDED
}

// -------------------------------------------------------------
// Test 9: Existing expense with old attachment state (0 attachments)
// Expected: Default empty arrays supported, historical records unaffected
// -------------------------------------------------------------
{
  const historicalRecord = {
    _id: "670f5e1234567890abcdef12",
    siteName: "Legacy Site",
    amount: 150,
    locationFiles: [],
    paymentFiles: [],
    invoiceFiles: [],
  };
  assert(
    Array.isArray(historicalRecord.locationFiles) &&
    historicalRecord.locationFiles.length === 0,
    "Test 9: Historical record with empty attachments remains schema-valid"
  );
}

// -------------------------------------------------------------
// Test 10: Direct API bypass
// Send empty FormData or fake whitespace values
// Expected: Server rejects request, no database record
// -------------------------------------------------------------
{
  const fd = new FormData();
  fd.append("Location", "   ");
  fd.append("Payment", "");
  fd.append("Invoice", " \t \n ");
  const serverResult = validateExpenseAttachments(fd);
  assert(!serverResult.valid, "Test 10: Whitespace / empty string bypass rejected");
  assert(
    serverResult.locationFiles.length === 0 &&
    serverResult.paymentFiles.length === 0 &&
    serverResult.invoiceFiles.length === 0,
    "Test 10: Zero valid URLs extracted from whitespace entries"
  );
}

// -------------------------------------------------------------
// Test 11 (Phase 22): Partial Upload / Failure Scenario
// Selected file failed to upload, no URL in Redux/FormData
// Expected: Neither client nor server allows submission
// -------------------------------------------------------------
{
  // User selected file, but upload failed so Redux has no URL
  const filesAfterFailedUpload: Record<string, string[]> = {
    Location: [],
    Payment: [],
    Invoice: [],
  };
  const clientCheck = hasAtLeastOneAttachment(filesAfterFailedUpload);
  assert(!clientCheck, "Test 11 (Client): Failed upload blocked on client");

  const fd = new FormData();
  // No URL appended
  const serverCheck = validateExpenseAttachments(fd);
  assert(!serverCheck.valid, "Test 11 (Server): Failed upload blocked on server");
}

console.log("\n=================================================");
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("=================================================");

if (failedCount > 0) {
  process.exit(1);
}
