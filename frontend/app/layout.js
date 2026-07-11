import "./globals.css";

export const metadata = {
  title: "Umuhinzi Score",
  description: "Credit scoring prototype for Rwanda's smallholder farmers",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
