import MainMenu from "@/components/MainMenu";

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 md:pl-60">
      <MainMenu />
      <main className="p-4 pb-20">{children}</main>
    </div>
  );
}
