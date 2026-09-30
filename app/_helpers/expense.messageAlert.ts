import axios from "axios";

export async function expenseMessageAlert(
  name: string,
  id: string,
  amount: number
) {
  const response = await axios.post(
    "https://www.fast2sms.com/dev/bulkV2",
    new URLSearchParams({
      sender_id: "INRTEC",
      message: "184060",
      variables_values: `${name}  | ${amount} |${id}`,
      route: "dlt",
      numbers: `${7011616143},${9891402128}`,
      // numbers: '7542918414',
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
