import axios from "axios";

export async function messageAlert(
  amount: number,
  name: string,
  fromPhone: number | null,
  toPhone: number | null
) {
  const response = await axios.post(
    "https://www.fast2sms.com/dev/bulkV2",
    new URLSearchParams({
      sender_id: "INTERZ",
      message: "181437",
      variables_values: `${amount} | ${name}`,
      route: "dlt",
      numbers: `${fromPhone},${toPhone}`,
    }),
    {
      headers: {
        Authorization: process.env.FAST2SMS as string,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  if (response.status !== 200) {
    return 400;
  }
  return 200;
}
