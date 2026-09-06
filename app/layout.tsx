import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ReplyRadar — Find the conversations worth joining",
  description:
    "Monitor X, discover high-value conversations, and join while they are still fresh.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
