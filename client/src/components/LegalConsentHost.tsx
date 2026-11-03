"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogOverlay, DialogPortal } from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { useAuth } from "../lib/auth";
import { useWallet } from "../hooks/use-wallet";
import { apiRequestV2 } from "../lib/queryClient";
import {
  LEGAL_VERSION, MIN_AGE, PRIVACY_URL, TERMS_URL,
  registerConsentPrompt, requestLegalConsent, saveConsent, storedConsent,
  type ConsentReason,
} from "../lib/legal";

const linkClass = "font-semibold text-[#2563eb] underline underline-offset-2 hover:text-[#1d4ed8]";
const checkClass = "mt-[1px] h-[18px] w-[18px] rounded-[6px] border-[1.25px] border-[#cfc9e6] bg-white data-[state=checked]:border-[#8a3ffc] data-[state=checked]:bg-[#8a3ffc] data-[state=checked]:text-white [&_svg]:h-[13px] [&_svg]:w-[13px]";
const pill = "flex h-[44px] flex-1 items-center justify-center rounded-[999px] border-[1.25px] px-[22px] text-[14.5px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50";

export default function LegalConsentHost() {
  const [prompt, setPrompt] = useState<{ reason: ConsentReason; resolve: (ok: boolean) => void } | null>(null);
  const [adult, setAdult] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const { user, setUser } = useAuth();
  const { disconnect } = useWallet();
  const pathname = usePathname();
  const checking = useRef(false);

  useEffect(() => {
    registerConsentPrompt(reason => new Promise(resolve => {
      setAdult(false);
      setAgreed(false);
      setPrompt({ reason, resolve });
    }));
    return () => registerConsentPrompt(null);
  }, []);

  useEffect(() => {
    if (!user || user.legalConsent?.version === LEGAL_VERSION || pathname?.startsWith("/docs") || checking.current) return;
    checking.current = true;
    (async () => {
      try {
        if (!(await requestLegalConsent("updated"))) { await disconnect(); return; }
        const consent = storedConsent();
        await apiRequestV2("POST", "/api/user/consent", { consent });
        setUser((u: any) => u && { ...u, legalConsent: consent });
      } catch {} finally {
        checking.current = false;
      }
    })();
  }, [user, pathname]);

  const answer = (ok: boolean) => {
    if (ok) saveConsent();
    prompt?.resolve(ok);
    setPrompt(null);
  };

  const updated = prompt?.reason === "updated";

  return (
    <DialogPrimitive.Root open={!!prompt}>
      <DialogPortal>
        <DialogOverlay className="z-[100] bg-[rgba(28,37,51,0.45)] backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          onEscapeKeyDown={e => e.preventDefault()}
          onInteractOutside={e => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[100] flex w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col gap-[16px] rounded-[32px] border-[1.25px] border-[#e8e4f6] bg-white p-[24px] drop-shadow-[0px_40px_40px_rgba(138,63,252,0.25)] sm:p-[28px]"
        >
          <DialogPrimitive.Title className="text-[22px] font-semibold leading-[28px] tracking-[-0.7px] text-[#1c2533]">
            {updated ? "We've updated our terms" : "Terms of Use and Privacy Policy"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-[14px] leading-[22px] text-[#5b6478]">
            {updated ? "Please review and agree to the updated " : "Please review and agree to the Nexura "}
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Terms of Use</a>
            {" and "}
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Privacy Policy</a>
            {updated ? " to keep using Nexura." : " to continue."}
          </DialogPrimitive.Description>

          <div className="flex flex-col gap-[12px] rounded-[20px] border-[1.25px] border-[#e8e4f6] bg-[#fbfaff] p-[16px]">
            <label className="flex cursor-pointer items-start gap-[12px] text-[13.5px] leading-[20px] text-[#1c2533]">
              <Checkbox checked={adult} onCheckedChange={v => setAdult(v === true)} className={checkClass} />
              I am {MIN_AGE} years of age or older
            </label>
            <label className="flex cursor-pointer items-start gap-[12px] text-[13.5px] leading-[20px] text-[#1c2533]">
              <Checkbox checked={agreed} onCheckedChange={v => setAgreed(v === true)} className={checkClass} />
              I have read and agree to the Terms of Use and Privacy Policy
            </label>
          </div>

          <div className="flex gap-[10px] pt-[4px]">
            <button type="button" onClick={() => answer(false)} className={`${pill} border-[rgba(28,37,51,0.15)] bg-white text-[#1c2533]`}>
              Disagree
            </button>
            <button
              type="button" disabled={!adult || !agreed} onClick={() => answer(true)}
              className={`${pill} border-[#8a3ffc] bg-[#8a3ffc] text-white drop-shadow-[0px_10px_13px_rgba(138,63,252,0.5)]`}
            >
              Agree
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
