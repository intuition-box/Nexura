import { Suspense } from "react";
import SignInFlow from "@/components/studio/auth/SignInFlow";

export default function StudioSignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInFlow />
    </Suspense>
  );
}
