import type { Metadata } from "next";
import localFont from "next/font/local";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Footer from "@app/_components/Footer";
import StoreProvider from "@app/_helpers/StoreProvider";
export const metadata: Metadata = {
  title: "CashWise",
  description: "Created by Ameya Innovex",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
         
        <ToastContainer />
        <main className="flex flex-col min-h-screen">
          <StoreProvider>
            
            {children}
            </StoreProvider>
        </main>
        <footer>
          <Footer />
        </footer>
      </body>
    </html>
  );
}
