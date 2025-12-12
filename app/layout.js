import "./globals.css";
import "../public/styles.css";

export const metadata = {
  title: "ICLR Review Radar",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="bg-gray-50 border-t mt-auto">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6 text-sm text-gray-600">
                <div>
                  <strong>ICLR Review Analysis Platform</strong>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                <span>© 2025 OpenReview Analysis | For Academic Research</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
