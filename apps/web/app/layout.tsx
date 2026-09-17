import "./globals.css";

export const metadata = {
  title: "Hausiplanner",
  description: "Hausaufgaben deiner Klasse auf einen Blick",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
