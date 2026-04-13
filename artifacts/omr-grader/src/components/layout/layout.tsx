import { Link, useLocation } from "wouter";
import { 
  Scan, 
  History, 
  Files, 
  Menu,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    { name: "Grade Sheet", href: "/", icon: Scan },
    { name: "Batch Grading", href: "/batch", icon: Layers },
    { name: "Templates", href: "/templates", icon: Files },
    { name: "History", href: "/history", icon: History },
  ];

  return (
    <div className="flex min-h-[100dvh] w-full bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <div className="flex items-center gap-2 font-semibold">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <Scan className="h-4 w-4" />
            </div>
            <span>GradeSnap</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] flex flex-col p-0">
              <div className="flex h-14 items-center border-b px-4">
                <div className="flex items-center gap-2 font-semibold">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
                    <Scan className="h-4 w-4" />
                  </div>
                  <span>GradeSnap</span>
                </div>
              </div>
              <nav className="flex-1 space-y-1 p-2">
                {navigation.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <Link key={item.name} href={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </Button>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 font-semibold md:hidden">
            <span>GradeSnap</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
