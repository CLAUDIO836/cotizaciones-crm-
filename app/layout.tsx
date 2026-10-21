import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import UpdateBanner from "@/components/UpdateBanner";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CRM TransCCL",
  description: "CRM de gestión comercial TransCCL",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CRM TransCCL',
  },
};

const BUILD_ID = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="CRM TransCCL" />
        <meta name="theme-color" content="#1B8A4B" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className={`${geist.className} min-h-full`}>
        {children}
        <Toaster richColors position="top-right" />
        <UpdateBanner currentBuildId={BUILD_ID} />
      </body>
    </html>
  );
}
