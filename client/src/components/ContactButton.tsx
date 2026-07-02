import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import ContactForm from "@/pages/ContactForm";

export default function ContactButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* زر الطفو */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center group"
        title="تواصل معنا"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
      </button>

      {/* نافذة الرسائل */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:p-6 p-0">
          {/* خلفية شفافة */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* النافذة */}
          <div className="relative z-10 w-full sm:w-[420px] h-[85vh] sm:h-[600px] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            <ContactForm onClose={() => setOpen(false)} mode="modal" />
          </div>
        </div>
      )}
    </>
  );
}
