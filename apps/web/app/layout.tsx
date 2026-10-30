import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "woibot.com — Your Personal AI Team That Actually Gets Work Done",
  description: "Teammate ดูแลทุกวัน — Work ลงมือทำจนส่งไฟล์จริง ใช้ได้ แก้ไขต่อได้ | Talk to your Teammate. Let Work handle the heavy lifting.",
  metadataBase: new URL("https://woibot.com"),
  openGraph: {
    title: "woibot.com — Your Personal AI Team That Actually Gets Work Done",
    description: "Teammate ดูแลทุกวัน — Work ลงมือทำจนส่งไฟล์จริง",
    url: "https://woibot.com",
    siteName: "woibot",
    locale: "th_TH",
    alternateLocale: "en_US",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={`${GeistSans.className} antialiased bg-[#f5f5f3] text-[#0d0d0d]`}>
        {children}
      </body>
    </html>
  );
}
