import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AuthStage from "@/pages/AuthStage";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ResetPassword from "@/pages/ResetPassword";
import SharedConversation from "./pages/SharedConversation";
import { FaqPage, PrivacyPage, TermsPage } from "./pages/SupportPage";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/share/:token"} component={SharedConversation} />
      <Route path={"/support/faq"} component={FaqPage} />
      <Route path={"/support/privacy"} component={PrivacyPage} />
      <Route path={"/support/terms"} component={TermsPage} />
      <Route path={"/signin"} component={AuthStage} />
      <Route path={"/signup"} component={AuthStage} />
      <Route path={"/forgot-password"} component={AuthStage} />
      <Route path={"/reset-password"} component={ResetPassword} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
