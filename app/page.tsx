"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.push("/login");
  }, [router]);
  return (
    <main className="w-screen h-screen overflow-hidden flex justify-center items-center">
      <h1 className="font-semibold text-sm text-red-600">
        Please wait redirecting to login page
      </h1>
    </main>
  );
}
