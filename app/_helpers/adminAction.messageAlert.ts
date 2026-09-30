import axios from "axios";

export async function adminActionMessageAlert(
  var1: string,
  var2: string,
  var3: string,
  number:number
) {
  const response = await axios.post(
    "https://www.fast2sms.com/dev/bulkV2",
    new URLSearchParams({
      sender_id: "INRTEC",
      message: "184344",
      variables_values: `${var1}  | ${var2} |${var3}`,
      route: "dlt",
    //   numbers: `${7011616143},${9891402128}`,
      numbers: `${number},${7011616143},${9891402128}`,
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
