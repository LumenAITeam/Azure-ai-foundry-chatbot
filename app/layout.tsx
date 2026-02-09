/* istanbul ignore file */
import type { Metadata } from "next"
import { Geist, Geist_Mono, Roboto } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"] })
const geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Lumen Technologies - Enterprise Chat",
  description: "Enterprise support chat powered by AI",
  generator: "Lumen Technologies",
  icons: {
    icon: "https://apac.lumen.com/wp-content/uploads/2023/04/lumenfavicon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <Analytics
          mode={"development"}
          scriptSrc="https://va.vercel-scripts.com/v1/script.debug.js"
        />
      </body>
    </html>
  )
}
