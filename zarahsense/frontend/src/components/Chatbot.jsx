import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { sendChatMessage } from '@/lib/api';

const STARTERS = [
  'Kenapa guna 5 stesen?',
  'Kenapa parameter tak banyak?',
  'Macam mana model ramal AQI?',
];

const WELCOME = 'Hai! Saya pembantu FYP ZarahSense. Tanya saya tentang stesen, parameter, model, data, ketepatan atau limitasi projek ini.';

function errorMessage(error) {
  const status = error.response?.status;
  const code = error.response?.data?.detail?.code;
  if (code === 'chat_not_configured') return 'Chatbot belum disediakan. Pemilik projek perlu set GEMINI_API_KEY di backend.';
  if (code === 'gemini_temporarily_unavailable') return 'Servis Gemini tengah sibuk atau tergendala (HTTP 503). Cuba lagi kemudian.';
  if (code === 'gemini_model_not_found') return 'Nama model Gemini yang dikonfigurasi tak tersedia. Pemilik projek perlu semak nama model.';
  if (code === 'gemini_authentication_failed') return 'Gemini menolak API key atau projek ini tiada akses kepada model. Semak API key dan Google AI Studio project.';
  if (code === 'gemini_network_error') return `Backend tak dapat sambung ke Gemini: ${error.response?.data?.detail?.message || 'semak internet, DNS atau firewall.'}`;
  if (code === 'gemini_timeout') return 'Gemini belum memberi respons selepas 30 saat. Cuba lagi sebentar nanti.';
  if (status === 429) return 'Had percuma Gemini sedang penuh atau anda menghantar mesej terlalu cepat. Cuba lagi sebentar nanti.';
  return 'Maaf, saya tak dapat hubungi AI sekarang. Cuba lagi sebentar nanti.';
}

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(() => window.sessionStorage.getItem('zs-chat-adult') === 'yes');
  const [messages, setMessages] = useState([{ role: 'model', text: WELCOME }]);
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, sending]);

  async function send(text = value) {
    const message = text.trim();
    if (!message || sending) return;

    const history = messages.slice(-8).map(({ role, text: content }) => ({ role, text: content }));
    setMessages((current) => [...current, { role: 'user', text: message }]);
    setValue('');
    setSending(true);
    try {
      const answer = await sendChatMessage(message, history, ageConfirmed);
      setMessages((current) => [...current, { role: 'model', text: answer }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'model', text: errorMessage(error) }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50" data-testid="fyp-chatbot">
      {open && (
        <section
          className="mb-3 flex w-[calc(100vw-2.5rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          style={{ height: 'min(620px, calc(100dvh - 100px))' }}
          aria-label="ZarahSense FYP assistant"
          data-testid="chatbot-panel"
        >
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle size={20} />
              <div>
                <h2 className="text-sm font-semibold">ZarahSense FYP Assistant</h2>
                <p className="text-xs opacity-85">Soalan tentang projek ini sahaja</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chatbot" className="rounded-md p-1 hover:bg-white/10">
              <X size={20} />
            </button>
          </header>

          {!ageConfirmed ? (
            <div className="flex flex-1 flex-col justify-center gap-4 p-5">
              <div>
                <h3 className="text-lg font-semibold">Untuk pengguna 18 tahun ke atas</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Gemini free tier mungkin menggunakan mesej untuk menambah baik produk dan semakan manusia. Jangan masukkan maklumat peribadi; data sensor live tidak dihantar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.sessionStorage.setItem('zs-chat-adult', 'yes');
                  setAgeConfirmed(true);
                }}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
                data-testid="chatbot-age-confirm"
              >
                Saya berumur 18 tahun ke atas — teruskan
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium"
                data-testid="chatbot-age-decline"
              >
                Saya bawah 18 tahun
              </button>
            </div>
          ) : (
            <>
          <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${item.role === 'user' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-secondary text-foreground'}`}>
                  {item.text}
                </p>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={sending}
                    onClick={() => send(question)}
                    className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
            {sending && <p className="text-xs text-muted-foreground" role="status">Sedang fikir…</p>}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Tanya tentang FYP ini…"
              aria-label="Your question"
              className="max-h-24 min-h-10 flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="chatbot-input"
            />
            <button
              type="submit"
              disabled={sending || !value.trim()}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              data-testid="chatbot-send"
            >
              <Send size={17} />
            </button>
          </form>
          <p className="px-3 pb-2 text-[11px] leading-snug text-muted-foreground" data-testid="chatbot-privacy-note">
            Jangan hantar maklumat peribadi. Tiada data sensor live dihantar. Chat ada had: 10 mesej seminit.
          </p>
            </>
          )}
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Close FYP assistant' : 'Open FYP assistant'}
        aria-expanded={open}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-testid="chatbot-toggle"
      >
        {open ? <X size={24} /> : <MessageCircle size={25} />}
      </button>
    </div>
  );
}
