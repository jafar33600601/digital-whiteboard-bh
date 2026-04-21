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
import LiveQuizHost from "./pages/LiveQuizHost";
import LiveQuizStudent from "./pages/LiveQuizStudent";
import PadletBoard from "./pages/PadletBoard";
import PadletStudent from "./pages/PadletStudent";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

function TeacherBoardRoute() {
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

function LiveQuizHostRoute({ params }: { params?: { id?: string } }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  const quizId = params?.id ? parseInt(params.id) : 0;
  return <LiveQuizHost quizId={quizId} />;
}

function LiveQuizStudentRoute({ params }: { params?: { code?: string } }) {
  const shareCode = params?.code ?? "";
  const { data: quiz } = trpc.quiz.getQuizByCode.useQuery({ shareCode }, { enabled: !!shareCode });
  if (!quiz) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full" />
    </div>
  );
  return <LiveQuizStudent quizId={quiz.id} shareCode={shareCode} />;
}

function PadletBoardRoute({ params }: { params?: { id?: string } }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl"><div className="animate-spin w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  return <PadletBoard />;
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
      <Route path="/quiz-live/:id" component={LiveQuizHostRoute} />
      <Route path="/quiz-join/:code" component={LiveQuizStudentRoute} />
      <Route path="/padlet/:id" component={PadletBoardRoute} />
      <Route path="/padlet-join" component={PadletStudent} />
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
