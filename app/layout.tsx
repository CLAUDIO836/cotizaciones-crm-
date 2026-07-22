import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import UpdateBanner from "@/components/UpdateBanner";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CRM Cotizaciones",
  description: "Sistema de cotizaciones y contratos",
};

const BUILD_ID = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className={`${geist.className} min-h-full`}>
        {children}
        <Toaster richColors position="top-right" />
        <UpdateBanner currentBuildId={BUILD_ID} />
      </body>
    </html>
  );
}
