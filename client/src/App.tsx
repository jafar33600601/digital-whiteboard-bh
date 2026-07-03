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
import LiveQuizResults from "./pages/LiveQuizResults";
import PadletBoard from "./pages/PadletBoard";
import PadletStudent from "./pages/PadletStudent";
import QuizizzHost from "./pages/QuizizzHost";
import QuizizzStudent from "./pages/QuizizzStudent";
import SpinnerWheel from "./pages/SpinnerWheel";
import LocalLogin from "./pages/LocalLogin";
import LocalRegister from "./pages/LocalRegister";
import Profile from "./pages/Profile";
import AdminUsers from "./pages/AdminUsers";
import ContactButton from "./components/ContactButton";
import ContactPage from "./pages/ContactForm";
import AdminMessages from "./pages/AdminMessages";
import Join from "./pages/Join";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocalAuth } from "./hooks/useLocalAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

// الموقع يستخدم نظام تسجيل الدخول المحلي دائماً (local auth only)
const IS_LOCAL_AUTH = true;

// مكوّن حماية المسارات للنظام المحلي
function LocalProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, hasToken } = useLocalAuth();
  
  // إذا لا يوجد token في localStorage → redirect فوري بدون انتظار
  if (!hasToken) {
    window.location.href = "/login";
    return null;
  }
  
  // يوجد token → انتظر تحقق السيرفر
  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  
  // السيرفر رفض الـ token (منتهي الصلاحية)
  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }
  
  return <>{children}</>;
}

function TeacherBoardRoute() {
  const pathParts = window.location.pathname.split("/");
  const sessionId = parseInt(pathParts[pathParts.length - 1] || "0");
  if (IS_LOCAL_AUTH) {
    return <LocalProtectedRoute><div className="min-h-screen flex flex-col bg-slate-50" dir="rtl"><TeacherBoard sessionId={sessionId} /></div></LocalProtectedRoute>;
  }
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }
  return (
    <div className="min-h-screen flex flex-col bg-slate-50" dir="rtl">
      <TeacherBoard sessionId={sessionId} />
    </div>
  );
}

function TeacherDashboardRoute() {
  if (IS_LOCAL_AUTH) {
    return <LocalProtectedRoute><div className="min-h-screen flex flex-col bg-slate-50" dir="rtl"><TeacherDashboard /></div></LocalProtectedRoute>;
  }
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }
  return (
    <div className="min-h-screen flex flex-col bg-slate-50" dir="rtl">
      <TeacherDashboard />
    </div>
  );
}
function QuizBuilderRoute({ params }: { params?: { id?: string } }) {
  if (IS_LOCAL_AUTH) return <LocalProtectedRoute><QuizBuilder params={params} /></LocalProtectedRoute>;
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) { window.location.href = '/login'; return null; }
  return <QuizBuilder params={params} />;
}
function QuizResultsRoute({ params }: { params?: { id?: string } }) {
  if (IS_LOCAL_AUTH) return <LocalProtectedRoute><QuizResults params={params} /></LocalProtectedRoute>;
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) { window.location.href = '/login'; return null; }
  return <QuizResults params={params} />;
}
function LiveQuizHostRoute({ params }: { params?: { id?: string } }) {
  const quizId = params?.id ? parseInt(params.id) : 0;
  if (IS_LOCAL_AUTH) return <LocalProtectedRoute><LiveQuizHost quizId={quizId} /></LocalProtectedRoute>;
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) { window.location.href = '/login'; return null; }
  return <LiveQuizHost quizId={quizId} />;
}
function LiveQuizResultsRoute({ params }: { params?: { id?: string } }) {
  const quizId = params?.id ? parseInt(params.id) : 0;
  if (IS_LOCAL_AUTH) return <LocalProtectedRoute><LiveQuizResults quizId={quizId} /></LocalProtectedRoute>;
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) { window.location.href = '/login'; return null; }
  return <LiveQuizResults quizId={quizId} />;
}

function LiveQuizStudentRoute({ params }: { params?: { code?: string } }) {
  const shareCode = params?.code ?? "";
  const { data: lookup, isLoading, isError } = trpc.lookupCode.useQuery({ code: shareCode }, { enabled: !!shareCode });
  if (isLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full" />
    </div>
  );
  if (isError || !lookup || lookup.type !== "kahoot") return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center" dir="rtl">
      <div className="text-white text-center">
        <p className="text-2xl font-bold mb-2">رمز غير صحيح أو انتهت الجلسة</p>
        <a href="/join" className="text-indigo-300 underline">جرب مرة أخرى</a>
      </div>
    </div>
  );
  return <LiveQuizStudent quizId={lookup.quizId} shareCode={shareCode} />;
}

function PadletStudentJoinRoute({ params }: { params?: { code?: string } }) {
  return <PadletStudent initialCode={params?.code} />;
}

function PadletBoardRoute({ params }: { params?: { id?: string } }) {
  if (IS_LOCAL_AUTH) return <LocalProtectedRoute><PadletBoard /></LocalProtectedRoute>;
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" dir="rtl"><div className="animate-spin w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) { window.location.href = '/login'; return null; }
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
      <Route path="/join" component={Join} />
      <Route path="/quiz-live/:id" component={LiveQuizHostRoute} />
      <Route path="/quiz-live-results/:id" component={LiveQuizResultsRoute} />
      <Route path="/quiz-join/:code" component={LiveQuizStudentRoute} />
      <Route path="/quizizz-host/:id" component={QuizizzHost} />
      <Route path="/quizizz/:code" component={QuizizzStudent} />
      <Route path="/padlet/:id" component={PadletBoardRoute} />
      <Route path="/padlet-join" component={() => <PadletStudent />} />
      <Route path="/padlet-join/:code" component={PadletStudentJoinRoute} />
      <Route path="/spinner-wheel" component={() => <SpinnerWheel />} />
      <Route path="/login" component={LocalLogin} />
      <Route path="/register" component={LocalRegister} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/contact" component={() => <ContactPage mode="page" />} />
      <Route path="/admin/messages" component={AdminMessages} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// يظهر زر التواصل فقط في الصفحة الرئيسية
function ContactButtonWrapper() {
  const [location] = useLocation();
  if (location !== "/") return null;
  return <ContactButton />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <Router />
          <ContactButtonWrapper />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
