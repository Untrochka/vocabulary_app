"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/shared/ui/Icon";

// AddScreen and ReadingScreen both used this same round "back home" button —
// the JSX used to be duplicated byte-for-byte across the two files.
export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/")}
      className="w-10 h-10 rounded-full bg-white border-2 border-swan grid place-items-center text-eel"
    >
      <Icon name="back" style={{ width: 18, height: 18 }} />
    </button>
  );
}
