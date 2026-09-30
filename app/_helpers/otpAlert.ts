import axios from "axios";

export async function otpAlert(otp:number,phone:number | null){
    const response = await axios.post(
                    "https://www.fast2sms.com/dev/bulkV2",
                    new URLSearchParams({
                      sender_id: "INTERZ",
                      message: "181436",
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
                  if(response.status!==200){
                    return 400
                    }
        return 200
}