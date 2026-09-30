import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Footer from "@app/_components/Footer";
import StoreProvider from "./_helpers/StoreProvider";
import Header from "./_components/Header";

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
            <Header/>
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
