import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./modernization.css";
import { DemoProvider } from "@/components/demo-provider";
import { existsSync } from "node:fs";
import { join } from "node:path";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "UCSA Election Management System",
    template: "%s · UCSA Elections",
  },
  description:
    "Student and committee portal for the Chadian Students Association at UNILAK, Kigali. Real election operation remains subject to approval.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="deployment-notice" role="status">
          UCSA demonstration · Fictional data only · Real electronic voting disabled
        </div>
        <DemoProvider
          officialLogoAvailable={existsSync(
            join(process.cwd(), "public", "ucsa-logo.png"),
          )}
        >
          {children}
        </DemoProvider>
      </body>
    </html>
  );
}
