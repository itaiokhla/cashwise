import * as React from "react";
import Box from "@mui/material/Box";
import Logo from "@app/_images/AmeyaInnovexLogo.png";
import Image from "next/image";

export default function Loader() {
  return (
    <Box
      className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-[999]"
      style={{ height: "100%", width: "100%" }}
    >
      {/* Logo and Spinner Container */}
      <div className="loadingio-spinner-spinner">
        <div className="ldio">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="bg-white"></div>
          ))}
          <Image
            src={Logo}
            alt="Loader Logo"
            className="w-16 h-16 mb-4"
            priority
          />
        </div>
      </div>

      {/* Spinner Styles */}
      <style jsx>{`
        .loadingio-spinner-spinner {
          display: inline-block;
          width: 80px;
          height: 80px;
          position: relative;
        }
        .ldio div {
          position: absolute;
          width: 5px;
          height: 15px;
          background: #ffffff;
          border-radius: 2px;
          transform-origin: 40px 40px;
          animation: ldio-spin 1.2s linear infinite;
        }
        .ldio div:nth-child(1) {
          animation-delay: -1.1s;
          transform: rotate(0deg) translate(0, -30px);
        }
        .ldio div:nth-child(2) {
          animation-delay: -1s;
          transform: rotate(30deg) translate(0, -30px);
        }
        .ldio div:nth-child(3) {
          animation-delay: -0.9s;
          transform: rotate(60deg) translate(0, -30px);
        }
        .ldio div:nth-child(4) {
          animation-delay: -0.8s;
          transform: rotate(90deg) translate(0, -30px);
        }
        .ldio div:nth-child(5) {
          animation-delay: -0.7s;
          transform: rotate(120deg) translate(0, -30px);
        }
        .ldio div:nth-child(6) {
          animation-delay: -0.6s;
          transform: rotate(150deg) translate(0, -30px);
        }
        .ldio div:nth-child(7) {
          animation-delay: -0.5s;
          transform: rotate(180deg) translate(0, -30px);
        }
        .ldio div:nth-child(8) {
          animation-delay: -0.4s;
          transform: rotate(210deg) translate(0, -30px);
        }
        .ldio div:nth-child(9) {
          animation-delay: -0.3s;
          transform: rotate(240deg) translate(0, -30px);
        }
        .ldio div:nth-child(10) {
          animation-delay: -0.2s;
          transform: rotate(270deg) translate(0, -30px);
        }
        .ldio div:nth-child(11) {
          animation-delay: -0.1s;
          transform: rotate(300deg) translate(0, -30px);
        }
        .ldio div:nth-child(12) {
          animation-delay: 0s;
          transform: rotate(330deg) translate(0, -30px);
        }
        @keyframes ldio-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Box>
  );
}
