import { ArrowRight, LogOut } from "lucide-react";

import { AgentModeProvider } from "@/components/agent-mode";
import { ConciergeChat } from "@/components/concierge-chat";
import { ModeBanner } from "@/components/mode-banner";
import { signOut } from "@/app/login/actions";

const gutter = "px-4 sm:px-[5vw] xl:px-20";

export default function Home() {
  return (
    <AgentModeProvider>
      <div className="min-h-screen bg-navy text-[#e8ecf4]">
        <ModeBanner />

        <header className={`border-b border-navy-rule ${gutter}`}>
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 py-5">
            <a href="#top" className="flex flex-col gap-2">
              <span className="text-[26px] font-bold tracking-[0.28em] text-[#f3f5fa]">THE MERIDIAN</span>
              <span className="text-[11px] font-bold tracking-[0.5em] text-ember">COLOMBO</span>
            </a>
            <nav aria-label="Main" className="flex flex-wrap items-center gap-8 text-base font-medium">
              <a href="#rooms" className="hover:text-ember">
                Rooms
              </a>
              <a href="#dining" className="hover:text-ember">
                Dining
              </a>
              <a href="#offers" className="hover:text-ember">
                Offers
              </a>
              <a href="#book" className="rounded-full bg-ember px-6 py-3 font-bold text-navy hover:bg-ember/90">
                Book Now
              </a>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-ember"
                  title="Sign out of the demo"
                >
                  <LogOut className="size-4" aria-hidden />
                  Sign out
                </button>
              </form>
            </nav>
          </div>
        </header>

        <main id="top">
          <section className="hero-photo">
            <div className={`mx-auto flex max-w-[1440px] flex-wrap items-end gap-10 pt-24 pb-14 ${gutter}`}>
              <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
                <span className="text-[13px] font-bold tracking-[0.24em] text-eyebrow">GALLE ROAD · COLOMBO</span>
                <h1 className="max-w-[720px] text-[clamp(44px,6vw,80px)] leading-[1.05] font-extrabold tracking-tight text-white">
                  Your retreat from the chaos
                </h1>
                <p className="max-w-[640px] text-xl leading-relaxed text-hero-copy">
                  Restored 1920s corridors, 64 rooms and deluxe suites, and The Verandah, our all-day dining room.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="#book"
                    className="rounded-full bg-ember px-8 py-4 text-[17px] font-bold text-navy hover:bg-ember/90"
                  >
                    Book your stay
                  </a>
                  <a
                    href="#rooms"
                    className="rounded-full bg-white px-8 py-4 text-[17px] font-bold text-navy hover:bg-white/90"
                  >
                    Explore suites
                  </a>
                </div>

                <BookingBar />
              </div>
            </div>
          </section>

          <section id="dining" className={`mx-auto flex max-w-[1440px] flex-col gap-5 pt-18 pb-24 ${gutter}`}>
            <span className="text-[13px] font-bold tracking-[0.24em] text-ember">STAY · DINE · UNWIND</span>
            <h2 className="text-5xl font-extrabold tracking-tight text-white">Since 1928</h2>
            <p className="max-w-[680px] text-[19px] leading-relaxed text-body-muted">
              A former merchant&apos;s residence, now a quiet hotel with sea-facing suites. The Meridian is your place
              to step away from the sprawl of city life.
            </p>
            <div className="mt-2 flex flex-wrap gap-10 text-[17px] font-bold">
              {["Rooms & suites", "The Verandah", "Offers"].map((label) => (
                <a key={label} href="#top" className="flex items-center gap-2 hover:text-ember">
                  {label} <ArrowRight className="size-4 text-ember" aria-hidden />
                </a>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Floating launcher + chat panel, pinned to the bottom-right corner. */}
      <ConciergeChat />
    </AgentModeProvider>
  );
}

function BookingBar() {
  const fields = [
    { label: "CHECK-IN", value: "Fri, 9 Oct" },
    { label: "CHECK-OUT", value: "Sun, 11 Oct" },
    { label: "GUESTS", value: "2 adults" },
  ];
  return (
    <div className="mt-16 flex max-w-[860px] flex-wrap items-center gap-6 rounded-2xl border border-navy-line bg-navy-card px-6 py-5">
      {fields.map((f, i) => (
        <div
          key={f.label}
          className={`flex flex-[1_1_120px] flex-col gap-2 ${i < fields.length - 1 ? "border-navy-line sm:border-r sm:pr-6" : ""}`}
        >
          <span className="text-xs font-bold tracking-[0.16em] text-label">{f.label}</span>
          <span className="text-lg font-semibold text-white">{f.value}</span>
        </div>
      ))}
      <button
        type="button"
        className="min-h-12 rounded-full bg-ember px-7 py-3.5 text-[17px] font-bold text-navy hover:bg-ember/90"
      >
        Check rates
      </button>
    </div>
  );
}
