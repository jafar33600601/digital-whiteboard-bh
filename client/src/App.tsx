import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import TeacherBoard from "./pages/TeacherBoard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentBoard from "./pages/StudentBoard";
import QuizBuilder from "./pages/QuizBuilder";
import QuizStudent from "./pages/QuizStudent";
import QuizResults from "./pages/QuizResults";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

function TeacherBoardRoute() {
  const params = new URLSearchParams(window.location.search);
  const pathParts = window.location.pathname.split("/");
  const sessionId = parseInt(pathParts[pathParts.length - 1] || "0");
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" dir="rtl">
      <TeacherBoard sessionId={sessionId} />
    </div>
  );
}

function TeacherDashboardRoute() {
  const pathParts = window.location.pathname.split("/");
  const sessionId = parseInt(pathParts[pathParts.length - 1] || "0");
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" dir="rtl">
      <TeacherDashboard />
    </div>
  );
}

function QuizBuilderRoute({ params }: { params?: { id?: string } }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  return <QuizBuilder params={params} />;
}

function QuizResultsRoute({ params }: { params?: { id?: string } }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  return <QuizResults params={params} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/teacher/:sessionId" component={TeacherBoardRoute} />
      <Route path="/dashboard/:sessionId" component={TeacherDashboardRoute} />
      <Route path="/join/:shareCode" component={StudentBoard} />
      <Route path="/quiz-builder/:id" component={QuizBuilderRoute} />
      <Route path="/quiz-results/:id" component={QuizResultsRoute} />
      <Route path="/quiz/:code" component={QuizStudent} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
