"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import Logo from "@app/_images/white_ameya_logo.png";
import Photo from "@app/_images/cashwisePhoto.png";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import Loader from "@app/_components/Loader";
import { setCookie } from "cookies-next";
import { AiOutlineEye, AiOutlineEyeInvisible } from "@node_modules/react-icons/ai";
import { HiOutlineMail, HiOutlinePhone, HiOutlineLockClosed } from "react-icons/hi";
import client from "@createRequest";
import { useAppDispatch, useAppSelector } from "@redux/redux.hooks";
import { selectUser, setUser } from "@redux/users/userSlice";
import { getCookie } from "cookies-next";

const Login = () => {
  const {
    handleSubmit,
    register,
    formState: { errors },
    getValues,
  } = useForm();

  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectUser);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [otpSent, setOtpSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    setMounted(true);
    const checkAuth = async () => {
      const accessToken = getCookie("accessToken");
      const role = getCookie("role");
      if (accessToken && role) {
        const path =
          role === "admin" || role === "manager"
            ? "/admin/account"
            : `/users/expenses/${user?._id ?? ""}`;
        window.location.href = path;
      }
    };
    checkAuth();
  }, [router, user?._id]);

  const startResendTimer = () => {
    setCanResend(false);
    setResendTimer(120);
  };

  const handleSendOtp = async () => {
    const phone = getValues("phone");
    if (!phone || phone.toString().length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    try {
      setIsLoading(true);
      const res = await client.put("/login", { phone });
      if (res.status === 200) {
        toast.success("OTP sent successfully");
        setOtpSent(true);
        startResendTimer();
      }
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const phone = getValues("phone");
    try {
      setIsLoading(true);
      const res = await client.put("/login", { phone });
      if (res.status === 200) {
        toast.success("OTP resent successfully");
        startResendTimer();
      }
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Failed to resend OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      setIsLoading(true);
      let response: any;
      if (loginMethod === "email") {
        response = await client.post("/login", {
          email: data.email,
          password: data.password,
        });
      } else {
        response = await client.post("/login", {
          phone: data.phone,
          otp: data.otp,
        });
      }
      if (response.status === 200) {
        dispatch(setUser(response.data?.user));
        const UserRole = response.data?.user?.role;
        localStorage.setItem("accessToken", response?.data?.accessToken);
        localStorage.setItem("role", UserRole);
        const path =
          UserRole === "admin" || UserRole === "manager"
            ? "/admin/account"
            : `/users/expenses/${response.data?.user?._id}`;
        toast.success(response.data?.message);
        window.location.href = path;
      }
    } catch (error) {
      toast.error((error as any)?.response?.data?.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          position: relative;
          min-height: 100dvh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
          padding: 1rem;
        }

        .bg-image {
          position: fixed;
          inset: 0;
          z-index: 0;
        }

        .bg-image img {
          object-fit: cover;
          object-position: center;
        }

        .bg-overlay {
          position: fixed;
          inset: 0;
          z-index: 1;
          background: linear-gradient(
            135deg,
            rgba(10, 6, 30, 0.88) 0%,
            rgba(30, 12, 60, 0.82) 50%,
            rgba(10, 6, 30, 0.92) 100%
          );
        }

        .card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 440px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          padding: 2rem 1.75rem;
          box-shadow:
            0 32px 64px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.04) inset,
            0 1px 0 rgba(255, 255, 255, 0.15) inset;
          animation: fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.75rem;
        }

        .brand-logo {
          width: 48px;
          height: 48px;
          object-fit: contain;
          filter: brightness(1.1);
        }

        .brand-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2rem;
          font-weight: 600;
          color: #ffffff;
          letter-spacing: 0.02em;
          line-height: 1;
        }

        .brand-title span {
          background: linear-gradient(90deg, #c084fc, #a855f7, #7c3aed);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .brand-sub {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 400;
        }

        .divider {
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, #7c3aed, #c084fc);
          border-radius: 2px;
          margin: 0 auto 1.5rem;
        }

        /* Toggle */
        .toggle-wrap {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          margin-bottom: 1.75rem;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 4px;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .toggle-btn {
          padding: 0.55rem 0.5rem;
          border-radius: 9px;
          font-size: 0.82rem;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          border: none;
          transition: all 0.25s ease;
          letter-spacing: 0.01em;
        }

        .toggle-btn.active {
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: #fff;
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.45);
        }

        .toggle-btn.inactive {
          background: transparent;
          color: rgba(255,255,255,0.5);
        }

        .toggle-btn.inactive:hover {
          color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.07);
        }

        /* Fields */
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .field-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: rgba(255,255,255,0.55);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          color: rgba(255,255,255,0.35);
          font-size: 1rem;
          pointer-events: none;
          transition: color 0.2s;
        }

        .field-input {
          width: 100%;
          padding: 0.72rem 1rem 0.72rem 2.6rem;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 11px;
          color: #fff;
          font-size: 0.9rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
          outline: none;
          transition: all 0.25s ease;
          -webkit-text-fill-color: #fff;
        }

        .field-input::placeholder {
          color: rgba(255,255,255,0.25);
        }

        .field-input:-webkit-autofill,
        .field-input:-webkit-autofill:hover,
        .field-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff !important;
          box-shadow: 0 0 0 1000px rgba(30,15,60,0.9) inset !important;
          caret-color: #fff;
        }

        .field-input:focus {
          border-color: rgba(168, 85, 247, 0.6);
          background: rgba(255,255,255,0.1);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.18);
        }

        .field-input:focus + .input-icon,
        .input-wrap:focus-within .input-icon {
          color: #a855f7;
        }

        .eye-btn {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.35);
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          padding: 4px;
          transition: color 0.2s;
        }

        .eye-btn:hover { color: rgba(255,255,255,0.8); }

        .error-msg {
          font-size: 0.72rem;
          color: #f87171;
          letter-spacing: 0.02em;
        }

        /* OTP row */
        .otp-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.6rem;
          align-items: flex-start;
        }

        .otp-send-btn {
          padding: 0.72rem 1rem;
          background: rgba(124,58,237,0.25);
          border: 1px solid rgba(124,58,237,0.4);
          border-radius: 11px;
          color: #c084fc;
          font-size: 0.78rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
          letter-spacing: 0.02em;
        }

        .otp-send-btn:hover {
          background: rgba(124,58,237,0.4);
          border-color: rgba(168,85,247,0.6);
          color: #e9d5ff;
        }

        .otp-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Submit */
        .submit-btn {
          width: 100%;
          padding: 0.85rem;
          background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #7c3aed 100%);
          background-size: 200% auto;
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 0.92rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(124,58,237,0.4);
          position: relative;
          overflow: hidden;
        }

        .submit-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }

        .submit-btn:hover {
          background-position: right center;
          box-shadow: 0 12px 32px rgba(124,58,237,0.55);
          transform: translateY(-1px);
        }

        .submit-btn:hover::after { opacity: 1; }

        .submit-btn:active { transform: translateY(0); }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .processing {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* Decorative orbs */
        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          z-index: 1;
          pointer-events: none;
        }

        .orb-1 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%);
          top: -100px;
          left: -100px;
        }

        .orb-2 {
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%);
          bottom: -80px;
          right: -80px;
        }

        /* Resend OTP */
        .resend-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          margin-top: 0.5rem;
          min-height: 1.4rem;
        }

        .resend-timer {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.02em;
        }

        .resend-countdown {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          color: #a855f7;
          font-size: 0.78rem;
        }

        .resend-btn {
          background: none;
          border: none;
          font-size: 0.78rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          color: #a855f7;
          cursor: pointer;
          letter-spacing: 0.03em;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          transition: all 0.2s;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .resend-btn:hover:not(:disabled) {
          color: #c084fc;
          background: rgba(168,85,247,0.1);
          text-decoration: none;
        }

        .resend-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Responsive */
        @media (min-width: 640px) {
          .card {
            padding: 2.5rem 2.25rem;
          }
          .brand-title { font-size: 2.4rem; }
        }
      `}</style>

      {isLoading && <Loader />}

      <div className="login-root">
        {/* Background Image */}
        <div className="bg-image">
          <Image src={Photo} alt="CashWise background" fill priority quality={90} />
        </div>

        {/* Gradient Overlay */}
        <div className="bg-overlay" />

        {/* Decorative orbs */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        {/* Glass Card */}
        <div className="card">
          {/* Brand */}
          <div className="brand">
            <Image src={Logo} alt="CashWise Logo" className="brand-logo" width={48} height={48} />
            <h1 className="brand-title">
              Cash<span>Wise</span>
            </h1>
            <p className="brand-sub">Smart Finance Management</p>
          </div>

          <div className="divider" />

          {/* Login Method Toggle */}
          <div className="toggle-wrap">
            <button
              type="button"
              onClick={() => setLoginMethod("email")}
              className={`toggle-btn ${loginMethod === "email" ? "active" : "inactive"}`}
            >
              ✉ Email
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("phone"); setOtpSent(false); }}
              className={`toggle-btn ${loginMethod === "phone" ? "active" : "inactive"}`}
            >
              📱 Phone
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="field-group">
              {loginMethod === "email" ? (
                <>
                  {/* Email */}
                  <div className="field">
                    <label className="field-label">Email Address</label>
                    <div className="input-wrap">
                      <HiOutlineMail className="input-icon" />
                      <input
                        type="email"
                        className="field-input placeholder:text-gray-500"
                        placeholder="you@example.com"
                        {...register("email", { required: true })}
                      />
                    </div>
                    {errors.email && <span className="error-msg">Email is required</span>}
                  </div>

                  {/* Password */}
                  <div className="field">
                    <label className="field-label">Password</label>
                    <div className="input-wrap">
                      <HiOutlineLockClosed className="input-icon" />
                      <input
                        type={showPassword ? "text" : "password"}
                        className="field-input placeholder:text-gray-500"
                        placeholder="••••••••"
                        {...register("password", { required: true })}
                      />
                      <button
                        type="button"
                        className="eye-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                      </button>
                    </div>
                    {errors.password && <span className="error-msg">Password is required</span>}
                  </div>
                </>
              ) : (
                <>
                  {/* Phone */}
                  <div className="field">
                    <label className="field-label">Phone Number</label>
                    <div className="otp-row">
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <div className="input-wrap">
                          <HiOutlinePhone className="input-icon" />
                          <input
                            type="tel"
                            className="field-input"
                            placeholder="10-digit number"
                            maxLength={10}
                            {...register("phone", { required: true, minLength: 10, maxLength: 10 })}
                          />
                        </div>
                        {errors.phone && <span className="error-msg">Valid phone number required</span>}
                      </div>
                      {!otpSent && (
                        <button
                          type="button"
                          className="otp-send-btn"
                          onClick={handleSendOtp}
                          disabled={isLoading}
                        >
                          {isLoading ? "..." : "Send OTP"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* OTP field */}
                  {otpSent && (
                    <div className="field" style={{ animation: "fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both" }}>
                      <label className="field-label">One-Time Password</label>
                      <div className="input-wrap">
                        <span className="input-icon" style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>
                          OTP
                        </span>
                        <input
                          type="text"
                          className="field-input"
                          placeholder="Enter OTP"
                          maxLength={6}
                          {...register("otp", { required: true })}
                        />
                      </div>
                      {errors.otp && <span className="error-msg">OTP is required</span>}
                      {/* Resend row */}
                      <div className="resend-row">
                        {canResend ? (
                          <button
                            type="button"
                            className="resend-btn"
                            onClick={handleResendOtp}
                            disabled={isLoading}
                          >
                            ↻ Resend OTP
                          </button>
                        ) : (
                          <span className="resend-timer">
                            Resend OTP in{" "}
                            <span className="resend-countdown">{formatTimer(resendTimer)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? (
                <span className="processing">
                  <span className="spinner" />
                  Processing…
                </span>
              ) : loginMethod === "email" ? (
                "Sign In"
              ) : (
                "Verify OTP"
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default Login;
