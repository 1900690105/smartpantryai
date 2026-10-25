import "./globals.css";

export const metadata = {
  title: "SmartPantry AI",
  description: "Smarter groceries, less food waste. Track pantry stock, product details and food rescue.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
