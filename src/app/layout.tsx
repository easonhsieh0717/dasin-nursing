import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "達心特護打卡系統",
  description: "達心護理特護人員打卡管理系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
