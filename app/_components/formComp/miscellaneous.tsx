import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { SlCalender } from "react-icons/sl";
import { toast } from "react-toastify";
import Sidebar from "@app/_components/Sidebar";
import Loader from "@app/_components/Loader";
import client from "@createRequest";
import { SiteInterface } from "@app/_interface/site.interface";
import { RxCross2 } from "react-icons/rx";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "../../../redux/users/userSlice";
import { FiFileText, FiTrash2 } from "react-icons/fi";
import { FaMapLocation } from "react-icons/fa6";
import { TbTransactionRupee } from "react-icons/tb";
import { FaFileInvoice } from "react-icons/fa6";
import { ImCross } from "react-icons/im";
import { motion } from "framer-motion";
import useLocation from "@hooks/useLocation";
import { usePathname } from "next/navigation";
import { selectFiles } from "@redux/files/filesSlice";
import AntdFileUpload from "../AntdUpload";
import { hasAtLeastOneAttachment, ATTACHMENT_REQUIRED_MESSAGE } from "@app/_lib/validateExpenseAttachment";

type expenseFormProps = {
  closeModal: () => void;
};
type FormValues = {
  siteName: string;
  todayWork: string;
  location: object;
  amount: number | null;
  description: string;
};

export default function Miscellaneous({ closeModal }: expenseFormProps) {
  const user = useAppSelector(selectUser);
  const userLocation = useLocation();
  const path = usePathname();
    const files= useAppSelector(selectFiles)
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const Error = (data: any) => toast.error(data);
  const Success = (data: any) => toast.success(data);
  const [sites, setSites] = useState<SiteInterface[]>([]);
  const [officeForm, setOfficeForm] = useState<boolean>(false);
  const [visibleDropdown, setVisibleDropdown] = useState<string | null>(null); // Track which dropdown is visible
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    control,
    reset,
    resetField,
    formState: { errors },
    getValues,
    setError,
  } = useForm<FormValues>({
    defaultValues: {
      siteName: "",
      todayWork: "",
      location: userLocation,
      amount: null,
      description: "",
    },
  });

  const watchSiteName = watch("siteName");
  useEffect(() => {
    setOfficeForm(path.includes("officeform"));
    async function allProducts() {
      try {
        const response = await client.get("/site/filtersite", {
          params: {
            siteName: watchSiteName,
          },
        });
        console.log(response);
        if (response.status === 200) {
          const resultData = ((response as any)?.data as SiteInterface[]) || [];
          setSites(resultData);
        }
      } catch (error: any) {
        Error(error.response?.data?.message || "Something went wrong!");
      } finally {
        setIsLoading(false);
      }
    }
    allProducts();
  }, [watchSiteName, path]);

  const onSubmit = async (data: FormValues) => {
    if (!hasAtLeastOneAttachment(files)) {
      return toast.error(ATTACHMENT_REQUIRED_MESSAGE);
    }
    const formdata = new FormData();
    formdata.append("miscellaneous", "miscellaneous");
    formdata.append("siteName", data.siteName);
    formdata.append("todayWork", data.todayWork);
    formdata.append("location", JSON.stringify(userLocation.currentLocation));
    formdata.append(
      "amount",
      data.amount !== null ? data.amount.toString() : ""
    );
    formdata.append("description", data.description);
    if (files.Location && Array.isArray(files.Location)) {
        files.Location.forEach((file: any) => {
          formdata.append("Location", file);
        });
      }
      if (files.Payment && Array.isArray(files.Payment)) {
        files.Payment.forEach((file: any) => {
          formdata.append("Payment", file);
        });
      }
      if (files.Invoice && Array.isArray(files.Invoice)) {
        files.Invoice.forEach((file: any) => {
          formdata.append("Invoice", file);
        });
      }

    try {
      setIsLoading(true);
      const response = await client.post(
        `/${officeForm ? "officeform" : "travelform"}/${user._id}`,
        formdata,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      if (response.status === 200 || response.status === 201) {
        reset();
        Success((response as any)?.data?.message);
        closeModal();
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      Error("Please Refresh Page to load data!");
    } finally {
      setIsLoading(false);
    }
  };
  const handleSiteClick = (site: SiteInterface) => {
    setValue("siteName", site.name);
    // setValue("siteLocation", site.address);
  };


  return (
    <>
      <div className="flex flex-row bg-[#f0ebf8] h-full mt-12 md:mt-0">
        <Sidebar />
        {isLoading && <Loader />}
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 py-4 ">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col items-center  h-full pr-2 max-w-md overflow-auto bg-white  rounded-xl"
          >
            <div className="relative bg-white rounded-xl shadow-lg w-full p-2">
              <div className="absolute top-0 left-0 right-0 h-12 bg-[#673ab7] rounded-t-xl">
                <motion.p
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                  className="float-end mt-4 mr-4 text-white text-2xl cursor-pointer"
                >
                  <ImCross onClick={closeModal} />
                </motion.p>
              </div>
              <div className="mt-12">
                <div className="text-left text-2xl font-bold  dark:text-black">
                  CashWise Expenses for Company <br />
                  कार्यालय के लिए नकदवार व्यय
                </div>
                <div className="text-left text-sm text-bold text-[#202124] mt-2">
                  Update daily expenses before 10:00 P.M. <br />
                  रात्रि 10:00 बजे से पहले दैनिक खर्च अपडेट करें।
                </div>
              </div>
            </div>

            {/* site name */}
            <div className="bg-white rounded-lg shadow-md p-6 w-full  mx-auto mt-2">
              <p className="text-lg font-bold text-left dark:text-black">
                Site Name (जगह का नाम)
              </p>
              <p className="text-sm text-[#202124] text-left mb-4"></p>
              <input
                {...register("siteName", {
                  required: "Site Name is Required",
                })}
                className="w-full p-2 border-b-2 border-[#e0e0e0] focus:outline-none focus:border-[#e0e0e0] dark:text-black"
                placeholder="Site Name"
                onFocus={(e) => {
                  e.preventDefault(), setVisibleDropdown("siteName");
                }}
              />
              {errors.siteName &&
                typeof errors.siteName.message === "string" && (
                  <p className="text-red-500">{errors.siteName.message}</p>
                )}
              {visibleDropdown === "siteName" && sites.length > 0 && (
                <div className="flex flex-col ">
                  <RxCross2
                    className="text-lg text-red-400 ml-[96%] cursor-pointer "
                    onClick={(e) => {
                      e.preventDefault(), setVisibleDropdown(null);
                    }}
                  />
                  <ul className="w-full  max-h-24 overflow-auto shadow-xl rounded-md bg-gray-300 hide-scrollbar">
                    {sites.map((site) => (
                      <li
                        key={site._id?.toString()}
                        className="border-b-2 hover:bg-gray-500 cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault(),
                            handleSiteClick(site),
                            setVisibleDropdown(null);
                        }}
                      >
                        {site.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md w-full  mx-auto mt-2 space-y-2">
              <p className="text-lg font-bold text-left dark:text-black">
                Today&apos;s Work
              </p>
              <p className="text-sm text-[#202124] text-left">आज का कार्य</p>
              <input
                {...register("todayWork", {
                  required: "Today's work is required",
                })}
                className="w-full p-2 border-b-2 border-[#e0e0e0] focus:outline-none focus:border-[#e0e0e0] dark:text-black"
              />
              {errors.todayWork &&
                typeof errors.todayWork.message === "string" && (
                  <p className="text-red-500">{errors.todayWork.message}</p>
                )}
            </div>
            {/* form with text and file input*/}
            <div className="bg-white p-6 rounded-lg shadow-md w-full  mx-auto mt-2 space-y-6">
              <div className="space-y-2">
                <div>
                  <p className="text-lg font-bold text-left dark:text-black">
                    Miscellaneous 1 (Amount in Rs.) By Bus, Metro, Auto
                  </p>
                  <p className="text-sm text-[#202124] text-left">
                    किराया (रुपये में)
                  </p>
                  <input
                    type="text"
                    {...register("amount", { required: "Amount Required!" })}
                    className="w-full p-2 border-b-2 border-[#e0e0e0] focus:outline-none focus:border-[#e0e0e0] dark:text-black"
                  />
                  {errors.amount && (
                    <span className="text-red-500">
                      {errors.amount.message}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold text-left dark:text-black">
                    Miscellaneous 1 (Description/Remarks)
                  </p>
                  <p className="text-sm text-[#202124] text-left">
                    किराया (विवरण/टिप्पणी)
                  </p>
                  <input
                    {...register("description", {
                      required: "Description Required!",
                    })}
                    className="w-full p-2 border-b-2 border-[#e0e0e0] focus:outline-none focus:border-[#e0e0e0] dark:text-black"
                  />
                  {errors.description && (
                    <span className="text-red-500">
                      {errors.description.message}
                    </span>
                  )}
                </div>
                <AntdFileUpload category={["Location","Payment","Invoice"]} />

              </div>
            
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6 w-full  mx-auto mt-2">
              <div className="text-lg font-bold text-left mb-2 dark:text-black">
                NOTICE
              </div>
              <div className="text-red-600 font-bold text-xl leading-8">
                Form को Submit करने से पहले अपने खर्च का हिसाब-किताब अच्छी तरह
                जांच लें क्यूंकि एक बार Submit करने बाद Form को Edit नहीं किया
                जा सकता।
              </div>

              <div className="flex justify-around items-center mt-4 mb-10 ">
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  type="button"
                  onClick={() => reset()}
                  className="text-purple-600 hover:underline ml-4"
                >
                  Clear form
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  type="submit"
                  className="bg-purple-600 text-white py-2 px-6 rounded-md font-semibold hover:bg-purple-700"
                >
                  Submit
                </motion.button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
