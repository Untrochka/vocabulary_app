import "./globals.css";
import type { ReactNode } from "react";
import { Nunito } from "next/font/google";
import { OfflineSync } from "@/shared/ui/OfflineSync";

const nunito = Nunito({ subsets: ["latin", "cyrillic"], variable: "--font-nunito", display: "swap" });

export const metadata = {
  title: "Vocabulary",
  description: "Learn and review words — your personal trainer",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
      </head>
      <body>
        <OfflineSync />
        {/* min-h-dvh (dynamic viewport height), not min-h-screen (100vh is fixed
            at load time and doesn't shrink when the keyboard opens — this was
            causing scroll jumps when typing a word on mobile). */}
        <div className="mx-auto w-full max-w-[440px] min-h-dvh px-[18px] pb-8 pt-[18px] bg-snow">
          {children}
        </div>
      </body>
    </html>
  );
}
