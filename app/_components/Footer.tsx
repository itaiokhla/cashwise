import React from "react";

const Footer = () => {
  return (
    <div className="flex items-center justify-center text-[7px] z-40 fixed bottom-0 w-full font-mono text-purple-600 font-semibold md:text-sm py-2 md:py-1 px-2 bg-white shadow-inner border-t-[1px] border-gray-50 text-center">
      Copyright © {new Date().getFullYear()} &nbsp;
      <a href="https://intertech.com.co/" target="_blank" className="underline">
        Inter-Tech
      </a>{" "}
      | Designed by&nbsp;
      <a href="https://iameya.in/" target="_blank" className="underline">
        Ameya Innovex&nbsp;
      </a>
    </div>
  );
};

export default Footer;
