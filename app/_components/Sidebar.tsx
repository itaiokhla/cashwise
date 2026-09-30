import { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  FaBars,
  FaCaretDown,
  FaUserCircle,
  FaTimes,
  FaWpforms,
  FaUsers,
  FaSitemap,
  FaUser,
} from "react-icons/fa";
import { BiSolidReport } from "react-icons/bi";
import { RiDashboardFill } from "react-icons/ri";
import { FaGaugeHigh } from "react-icons/fa6";
import ls from "localstorage-slim";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MdOutlineAccountBalance,
  MdOutlineContactPage,
  MdDashboardCustomize,
} from "react-icons/md";
import { IoSettingsOutline } from "react-icons/io5";
import Image from "next/image";
import logo from "@app/_images/cashwise_logo.png";
import intertechlogo from "@app/_images/Intertech-removebg-preview.png";
import client from "@createRequest";
import { toast } from "react-toastify";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";
import Loader from "./Loader";
import { GiPayMoney, GiPostOffice } from "react-icons/gi";
import { TiGroup } from "react-icons/ti";
import { TbNotebook } from "react-icons/tb";
import { MdOutlinePayment } from "react-icons/md";
import { BsJournalBookmarkFill } from "react-icons/bs";
import { FaBookReader } from "react-icons/fa";

const Sidebar = () => {
  const user:any = useAppSelector(selectUser);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  const showError = (data: any) => toast.error(data);
  const showSuccess = (data: any) => toast.success(data);

  const isAdminOrManager = user.role === "admin" || user.role === "manager";
  const canAccessToPayForm = user.role === "admin" || user.role === "toPay";

  const navigationConfig = useMemo(() => {
    const isAdminOrManager = user.role === "admin" || user.role === "manager";
    const canAccessToPayForm = user.role === "admin" || user.role === "toPay";
const tallyIntegrationAccess = user._id === "67e524ff66dcb162c7476000" || user._id === "67e525f3b5239a00bf276fd3" || user._id === "697d7dfd5ec96f1edc3ba94a";
    const commonItems = [
      {
        type: "item",
        icon: <MdOutlineAccountBalance />,
        label: "Account",
        path: "/account",
      },
      {
        type: "item",
        icon: <TiGroup />,
        label: "Group",
        path: "/group",
      },
    ];

    if (isAdminOrManager) {
      return [
        {
          type: "dropdown",
          icon: <MdDashboardCustomize />,
          label: "Dashboard",
          subitems: [
            {
              icon: <GiPayMoney />,
              label: "Account Dashboard",
              path: "/admin/account",
            },
            {
              icon: <GiPostOffice />,
              label: "Travel/Office Dashboard",
              path: "/admin/dashboard",
            },
            ...(canAccessToPayForm
              ? [
                  {
                    icon: <MdOutlineContactPage />,
                    label: "To Pay Form",
                    path: "/toPayExpense",
                  },
                ]
              : []),
          ],
        },
        {
          type: "item",
          icon: <FaUser />,
          label: "Users",
          path: "/users",
        },
        ...(tallyIntegrationAccess ? [
          {
          type: "item",
          icon: <TbNotebook />,
          label: "Ledgers",
          path: "/ledger",
        },
        {
          type: "dropdown",
          icon: <FaBookReader />,
          label: "Vouchers",
          subitems: [
            {
              icon: <MdOutlinePayment />,
              label: "Payment Voucher",
              path: "/paymentVoucher",
            },
            {
              icon: <BsJournalBookmarkFill />,
              label: "Journal Voucher",
              path: "/journalVoucher",
            },],
        },
        ] : []),
        
        {
          type: "item",
          icon: <BiSolidReport />,
          label: "Reports",
          path: "/reportsDownload",
        },
        {
          type: "item",
          icon: <FaGaugeHigh />,
          label: "Expense Limit",
          path: "/admin/expenseLimit",
        },
        {
          type: "item",
          icon: <FaSitemap />,
          label: "Site",
          path: "/site",
        },
        {
          type: "item",
          icon: <IoSettingsOutline />,
          label: "Settings",
          path: "/settings",
        },
        {
          type: "dropdown",
          icon: <RiDashboardFill />,
          label: "Form",
          subitems: [
            {
              icon: <FaWpforms />,
              label: "Travel Form",
              path: "/travelExpense",
            },
            {
              icon: <MdOutlineContactPage />,
              label: "Office Form",
              path: "/officeExpense",
            },
            ...(canAccessToPayForm
              ? [
                  {
                    icon: <MdOutlineContactPage />,
                    label: "To Pay Form",
                    path: "/toPayExpense",
                  },
                ]
              : []),
          ],
        },
        ...commonItems,
      ];
    } else {
      return [
        {
          type: "item",
          icon: <MdDashboardCustomize />,
          label: "Dashboard",
          path: `/users/expenses/${user._id}`,
        },
        {
          type: "dropdown",
          icon: <RiDashboardFill />,
          label: "Form",
          subitems: [
            ...(user.role === "toPay"
              ? [
                  {
                    icon: <MdOutlineContactPage />,
                    label: "To Pay Form",
                    path: "/toPayExpense",
                  },
                ]
              : [
                  {
                    icon: <FaWpforms />,
                    label: "Travel Form",
                    path: "/travelExpense",
                  },
                  {
                    icon: <MdOutlineContactPage />,
                    label: "Office Form",
                    path: "/officeExpense",
                  },
                ]),
          ],
        },
        ...commonItems,
      ];
    }
  }, [user._id, user.role]);

  useEffect(() => {
    const handleResize = () => {
      setIsOpen(window.innerWidth >= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => setIsOpen(!isOpen);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const response = await client.post("/users/logout");
      if (response.status === 200) {
        showSuccess(response?.data?.message);
        window.location.href = "/login";
      }
    } catch (error: any) {
      console.error("Error during logout:", error);
      showError(error.response?.data?.message || "Something went wrong!");
    } finally {
      setIsLoading(false);
    }
  };

  const renderNavItems = () => {
    return navigationConfig.map((item: any, index) => {
      if (item.type === "item") {
        return (
          <NavItem
            key={`nav-item-${index}`}
            icon={item.icon}
            label={item.label}
            path={item.path}
          />
        );
      } else if (item.type === "dropdown") {
        return (
          <NavDropdown
            key={`nav-dropdown-${index}`}
            icon={item.icon}
            label={item.label}
            subitems={item.subitems}
          />
        );
      }
      return null;
    });
  };

  return (
    <>
      {isLoading && <Loader />}

      <motion.button
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <FaBars className="text-purple-600" size={24} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-0 left-0 h-full bg-gradient-to-b from-purple-50 to-white shadow-xl z-50 w-64 overflow-auto"
      >
        <div className="flex flex-col h-full p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col items-center gap-4">
              <span className="flex items-center gap-4 text-2xl border-b py-2 font-bold text-purple-500">
                <span>
                  <Image
                    src={intertechlogo}
                    alt="Intertech Logo"
                    className="rounded-full border-2 border-purple-500 p-2 h-12 w-32"
                  />
                </span>
              </span>
              <span className="flex items-center gap-4 text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                CASHWISE{" "}
                <span>
                  <Image
                    src={logo}
                    width={48}
                    height={48}
                    alt="Cashwise Logo"
                    className="rounded-full border-2 border-purple-500"
                  />
                </span>
              </span>
            </div>
            <button
              onClick={toggleSidebar}
              className="md:hidden p-2 hover:bg-purple-300 rounded-full"
            >
              <FaTimes className="text-gray-600" size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">{renderNavItems()}</nav>

          {/* User Profile */}
          <div className="border-t border-purple-100 pt-4 mt-auto mb-8">
            <Popover className="relative">
              <PopoverButton className="w-full flex items-center gap-3 p-2 hover:bg-purple-200 rounded-xl transition-colors">
                <FaUserCircle className="text-purple-600" size={32} />
                <div className="text-left flex-1">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user.role}
                  </p>
                </div>
                <FaCaretDown className="text-gray-400" />
              </PopoverButton>

              <PopoverPanel className="absolute bottom-full left-0 w-full bg-violet-500 hover:bg-violet-700 shadow-lg rounded-xl p-1 mb-2 border border-gray-100">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm rounded-lg transition-colors"
                >
                  Logout
                </button>
              </PopoverPanel>
            </Popover>
          </div>
        </div>
      </motion.aside>

      {/* Content Area */}
      <div
        className={`transition-all duration-300 ${
          isOpen ? "md:ml-64" : "md:ml-0"
        }`}
      ></div>
    </>
  );
};

const NavItem = ({ icon, label, path }: any) => {
  const pathname = usePathname();
  const isActive = pathname === path;

  return (
    <Link href={path} passHref>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
          isActive
            ? "bg-purple-200 text-purple-700"
            : "text-gray-700 hover:bg-purple-100"
        }`}
      >
        <span
          className={`text-xl ${
            isActive ? "text-purple-700" : "text-purple-600"
          }`}
        >
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </motion.div>
    </Link>
  );
};

const NavDropdown = ({ icon, label, subitems }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Check if any subitems match the current path
  const hasActivePath = useMemo(() => {
    return subitems.some((item: any) => item.path === pathname);
  }, [subitems, pathname]);

  return (
    <div className="w-full">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
          hasActivePath
            ? "bg-purple-200 text-purple-700"
            : "text-gray-700 hover:bg-purple-100"
        }`}
      >
        <span
          className={`text-xl ${
            hasActivePath ? "text-purple-700" : "text-purple-600"
          }`}
        >
          {icon}
        </span>
        <span className="text-sm font-medium flex-1 text-left">{label}</span>
        <FaCaretDown
          className={`transform transition-transform ${
            isOpen ? "rotate-180" : ""
          } ${hasActivePath ? "text-purple-700" : "text-gray-400"}`}
        />
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-8 space-y-1"
          >
            {subitems.map((item: any, index: number) => (
              <NavItem
                key={`${item.path}-${index}`}
                icon={item.icon}
                label={item.label}
                path={item.path}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Sidebar;
