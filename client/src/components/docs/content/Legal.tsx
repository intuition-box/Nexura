"use client";

const Legal = ({ onNext, onPrev }: any) => {
  return (
    <div id="legal docs-top" className="max-w-[59rem]">

      {/* Heading */}
      <h2 id="terms-of-use" className="text-white text-xl font-semibold">
        Terms of Use
      </h2>

      {/* Intro */}
      <p className="text-gray-400 text-sm mt-4">
        By accessing and using Nexura, you agree to the following terms:
      </p>

      {/* Terms List */}
      <ul className="mt-6 space-y-4 text-gray-400 text-sm list-none">

        <li>
          <span className="text-[#8B3EFE] font-medium">• Eligibility:</span>{" "}
          You must be of legal age in your jurisdiction to use Nexura. By connecting your wallet, you confirm that you are legally permitted to interact with blockchain-based platforms in your region.
        </li>

        <li>
          <span className="text-[#8B3EFE] font-medium">• Wallet Responsibility:</span>{" "}
          Your wallet is your identity on Nexura. You are solely responsible for the security of your wallet credentials, including your private key and seed phrase. Nexura does not store, have access to, or have any ability to recover your wallet credentials.
        </li>

        <li>
          <span className="text-[#8B3EFE] font-medium">• Participation:</span>{" "}
          Participation on Nexura must be genuine. Attempting to manipulate the system through multiple wallets, automated interactions, fabricated proof of action, or any other method designed to inflate participation metrics or rewards is a violation of these terms and may result in your wallet being banned from programs across the platform.
        </li>

        <li>
          <span className="text-[#8B3EFE] font-medium">• Quest and Campaign Completion:</span>{" "}
          Completing a quest or campaign and submitting proof of action is a declaration that the described activity was genuinely performed by the wallet submitting the claim. Also note that Nexura has the right to review quests and remove any quest that does not align with the Nexura safety guidelines to protect users from scams and bad actors. False or misleading submissions are a violation of these terms.
        </li>

        <li>
          <span className="text-[#8B3EFE] font-medium">• Ecosystem Dapps:</span>{" "}
          All dapps listed on Nexura, except the Intuition Portal, are community-built. We only display them for discovery and visibility purposes. This does not mean we endorse, control, audit, or take responsibility for these projects. We do not have control over how these dapps function, how they manage user data or funds, or any issues you may encounter while using them. Users are advised to do their own research and exercise caution when interacting with any third-party dapps.
        </li>

      </ul>

      {/* Changes to Terms */}
      <div id="changes-to-terms" className="mt-8">
        <h3 className="text-2xl font-medium">
          Changes to Terms
        </h3>

        <p className="text-gray-400 text-sm mt-3">
          Nexura reserves the right to update these terms at any time. Continued use of the platform following any updates constitutes acceptance of the revised terms.
        </p>
      </div>

            {/* Navigation Buttons */}
      <div className="mt-10 flex justify-between max-w-[59rem]">

        {/* Previous */}
        <div
          onClick={onPrev}
          className="w-[10rem] cursor-pointer group border border-white/30 rounded-lg p-2"
        >
          <div className="flex justify-start">
            <h4 className="text-[#8B3EFE] text-xs font-medium tracking-wider">
              PREVIOUS
            </h4>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-[#8B3EFE] transition group-hover:-translate-x-1">
              ←
            </span>

            <p className="text-gray-400 text-sm">
              FAQs
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Legal;