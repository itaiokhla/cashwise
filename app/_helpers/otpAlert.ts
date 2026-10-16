import axios from "axios";

export async function otpAlert(otp: number, phone: number | string) {
  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      new URLSearchParams({
        sender_id: "INRTEC",
        message: "188773", // DLT template: "Cashwise Login OTP ... {#VAR#}"
        variables_values: `${otp}`,
        route: "dlt",
        numbers: `${phone}`,
      }),
      {
        headers: {
          Authorization: process.env.FAST2SMS as string,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    // Fast2SMS can answer 200 with `return: false` when it rejects the SMS
    if (response.status !== 200 || !response.data?.return) {
      console.error("OTP SMS not sent:", response.data?.message);
      return 400;
    }
    return 200;
  } catch (error: any) {
    // axios throws on non-2xx; Fast2SMS puts the reason in the response body
    console.error(
      "OTP SMS not sent:",
      error?.response?.data?.message || error?.message
    );
    return 400;
  }
}
