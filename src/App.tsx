import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FeatureFlagProvider } from "@/contexts/FeatureFlagContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Manage from "./pages/Manage";
import SiteEditor from "./pages/SiteEditor";
import GithubCallback from "./pages/GithubCallback";
import AcceptInvite from "./pages/AcceptInvite";
import GuestUpload from "./pages/GuestUpload";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <FeatureFlagProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/manage/:siteId" element={<Manage />} />
              <Route path="/edit/:siteId" element={<SiteEditor />} />
              <Route path="/edit/:siteId/:filePath" element={<SiteEditor />} />
              <Route path="/invite/:token" element={<AcceptInvite />} />
              <Route path="/upload/:token" element={<GuestUpload />} />
              <Route path="/github/callback" element={<GithubCallback />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </FeatureFlagProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
