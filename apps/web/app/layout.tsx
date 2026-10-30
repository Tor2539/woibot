import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://woibot.com"),
  title: "woibot.com — AI Personal Teammate & AI Workforce",
  description:
    "Teammate ดูแลงานประจำวันบน Cloud Computer 24 ชม. — Work ลงมือสร้าง Code, Video, Documents และ Artifacts พร้อมระบบตรวจสอบคุณภาพ | Talk to your Teammate. Let Work handle the heavy lifting.",
  openGraph: {
    title: "woibot.com — AI Personal Teammate & AI Workforce",
    description: "Talk to your Teammate. Let Work handle the heavy lifting.",
    url: "https://woibot.com",
    siteName: "woibot",
    locale: "th_TH",
    type: "website",
  },
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('woibot.theme');
    var theme = (saved === 'light' || saved === 'dark') ? saved : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${notoSansThai.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased selection:bg-[#2b66e0]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
