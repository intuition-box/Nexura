"use client";

import type { ReactNode } from "react";
import { LEGAL_UPDATED, MIN_AGE, PRIVACY_URL, TERMS_URL } from "@/lib/legal";

const Item = ({ label, children }: { label: string; children: ReactNode }) => (
  <li>
    <span className="text-[#8B3EFE] font-medium">• {label}:</span>{" "}
    {children}
  </li>
);

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <div id={id} className="mt-8 scroll-mt-6">
    <h3 className="text-2xl font-medium">{title}</h3>
    <div className="text-gray-400 text-sm mt-3 space-y-3 leading-6">{children}</div>
  </div>
);

const List = ({ children }: { children: ReactNode }) => (
  <ul className="mt-4 space-y-4 text-gray-400 text-sm list-none leading-6">{children}</ul>
);

const link = "text-blue-400 underline underline-offset-2 hover:text-blue-300";

export const LEGAL_SECTIONS = [
  { id: "legal", title: "Terms, Policies and Disclaimer", level: 1 },
  { id: "terms-of-use", title: "Terms of Use", level: 2 },
  { id: "acceptance", title: "1. Agreement to These Terms", level: 3 },
  { id: "about-nexura", title: "2. About Nexura", level: 3 },
  { id: "eligibility", title: "3. Eligibility", level: 3 },
  { id: "wallets-and-accounts", title: "4. Wallets and Accounts", level: 3 },
  { id: "campaigns", title: "5. Campaigns", level: 3 },
  { id: "social-graph", title: "6. The Decentralized Social Graph", level: 3 },
  { id: "rewards", title: "7. Rewards, XP and Nexura Score", level: 3 },
  { id: "nexura-studio", title: "8. Nexura Studio", level: 3 },
  { id: "partners", title: "9. Partners and Third-Party Projects", level: 3 },
  { id: "acceptable-use", title: "10. Acceptable Use", level: 3 },
  { id: "fraud-prevention", title: "11. Fraud Prevention", level: 3 },
  { id: "your-content", title: "12. Your Content", level: 3 },
  { id: "intellectual-property", title: "13. Nexura's Intellectual Property", level: 3 },
  { id: "blockchain-risks", title: "14. Blockchain and Digital Asset Risks", level: 3 },
  { id: "no-advice", title: "15. No Financial Advice", level: 3 },
  { id: "disclaimers", title: "16. Disclaimers", level: 3 },
  { id: "limitation-of-liability", title: "17. Limitation of Liability", level: 3 },
  { id: "indemnity", title: "18. Indemnity", level: 3 },
  { id: "ending-use", title: "19. Ending Your Use", level: 3 },
  { id: "changes-to-terms", title: "20. Changes to These Terms", level: 3 },
  { id: "disputes", title: "21. Disputes", level: 3 },
  { id: "general", title: "22. General", level: 3 },
  { id: "privacy-policy", title: "Privacy Policy", level: 2 },
  { id: "privacy-overview", title: "How Nexura Handles Information", level: 3 },
  { id: "knowledge-graph-records", title: "Records on the Knowledge Graph", level: 3 },
  { id: "information-we-collect", title: "Information the App Uses", level: 3 },
  { id: "how-we-use-information", title: "How Information Is Used", level: 3 },
  { id: "public-information", title: "What Others Can See", level: 3 },
  { id: "how-we-share-information", title: "Sharing", level: 3 },
  { id: "data-retention", title: "Retention", level: 3 },
  { id: "your-choices", title: "Your Control", level: 3 },
  { id: "security", title: "Security", level: 3 },
  { id: "children", title: "Children", level: 3 },
  { id: "international-transfers", title: "International Use", level: 3 },
  { id: "policy-changes", title: "Changes to This Policy", level: 3 },
  { id: "contact", title: "Contact", level: 3 },
];

const Legal = ({ onPrev }: any) => {
  return (
    <div id="legal" className="max-w-[59rem]">

      <p className="text-gray-500 text-xs">Last updated {LEGAL_UPDATED}</p>

      <h2 id="terms-of-use" className="text-white text-xl font-semibold mt-4 scroll-mt-6">
        Terms of Use
      </h2>

      <p className="text-gray-400 text-sm mt-4 leading-6">
        These Terms of Use govern your access to and use of the Nexura app, Nexura Studio, the Nexura documentation, and every related website, interface, bot and integration (together, "Nexura"). Please read them carefully. They include important limits on liability and how disputes are handled.
      </p>

      <Section id="acceptance" title="1. Agreement to These Terms">
        <p>
          By agreeing when prompted, connecting a wallet, creating a Studio account, or otherwise using Nexura, you agree to these Terms and to the{" "}
          <a href={PRIVACY_URL} className={link}>Privacy Policy</a>. If you use Nexura on behalf of a project, company or other organization, you agree on its behalf and confirm that you have authority to do so. If you do not agree, do not use Nexura.
        </p>
      </Section>

      <Section id="about-nexura" title="2. About Nexura">
        <p>
          Nexura is a decentralized social graph for the Intuition ecosystem. It connects people and projects through campaigns and records contributions on the Intuition knowledge graph, an open, public and decentralized protocol that no single party controls.
        </p>
        <List>
          <Item label="Nexura App">
            Where participants discover projects, join campaigns, peer review tasks, vouch for other participants, curate projects, and build a public track record of their contributions.
          </Item>
          <Item label="Nexura Studio">
            Where projects create a hub, manage their team, and create, fund and run campaigns for their communities.
          </Item>
          <Item label="The Knowledge Graph">
            Contribution records, vouches, reviews and curation signals are written to the Intuition knowledge graph. They belong to the wallets that create them and can be read by anyone, through Nexura or any other application.
          </Item>
        </List>
        <p>
          Nexura provides software and interfaces. It is not a party to arrangements between participants and projects, does not hold anyone's funds, and does not custody any digital assets.
        </p>
      </Section>

      <Section id="eligibility" title="3. Eligibility">
        <p>
          You must be at least {MIN_AGE} years old and have the legal capacity to enter into these Terms. You may not use Nexura if you are located in, or are a resident of, a country or region subject to comprehensive sanctions, if you are listed on any sanctions list, or if using Nexura would be unlawful where you are. You are responsible for knowing and following the laws that apply to you, including laws on digital assets and taxes.
        </p>
      </Section>

      <Section id="wallets-and-accounts" title="4. Wallets and Accounts">
        <List>
          <Item label="Your Wallet">
            Your wallet is your identity on Nexura. You sign a message to prove you control it. Nexura never asks for, receives or stores your private key or seed phrase and cannot recover a lost wallet. You are solely responsible for your wallet's security and for every action signed with it.
          </Item>
          <Item label="One Person, One Identity">
            Each person may take part with one wallet. Creating or operating multiple identities to gain extra rewards, reputation or influence is not allowed.
          </Item>
          <Item label="Studio Accounts">
            Studio accounts use an email address and password and are linked to a wallet. You must provide accurate information, keep your credentials confidential, and use two-factor authentication where it is offered. You are responsible for all activity under your Studio account.
          </Item>
          <Item label="Connected Accounts">
            You may connect X or Discord so campaign tasks can be verified. Your use of those platforms remains subject to their own terms.
          </Item>
          <Item label="Sessions">
            If you choose to stay signed in, anyone with access to your device may be able to act as you. Sign out on shared devices.
          </Item>
        </List>
      </Section>

      <Section id="campaigns" title="5. Campaigns">
        <p>
          Campaigns are created, funded and run by projects through Nexura Studio. A campaign can be made of stages that open over time and may require participants to return and complete tasks across those stages.
        </p>
        <List>
          <Item label="Project Responsibility">
            Each campaign belongs to the project that created it. The project sets its tasks, dates, eligibility, verification method and rewards, and is responsible for its content and for honoring its commitments. Nexura does not create, review or approve campaigns and does not guarantee any campaign or its outcome.
          </Item>
          <Item label="Genuine Participation">
            Submitting a task or proof of action is your declaration that you personally performed the described activity, honestly and with the wallet making the claim.
          </Item>
          <Item label="Verification">
            Tasks may be verified automatically, through connected accounts, through on-chain data, by the project, or by peer review from other participants. A project may decline submissions that do not meet its campaign requirements.
          </Item>
          <Item label="Schedules">
            Campaigns run between their published start and end dates. Projects may change a live campaign only through their hub's governance process, and changes apply from the time they take effect.
          </Item>
        </List>
      </Section>

      <Section id="social-graph" title="6. The Decentralized Social Graph">
        <p>
          Nexura lets participants signal trust and quality to one another. These signals form a shared, public reputation layer that no single party owns or controls.
        </p>
        <List>
          <Item label="Peer Review">
            Participants can review the tasks other participants submit. Reviews must be honest, independent and based on the submission itself.
          </Item>
          <Item label="Vouching">
            You can vouch for other participants. A vouch is a public statement, made with your wallet, that you trust that participant. Vouch only for people you genuinely know or have reason to trust.
          </Item>
          <Item label="Curation">
            You can curate projects by signaling their quality and relevance. Curation reflects your own view and is not a recommendation by Nexura.
          </Item>
          <Item label="Your Signals Are Yours">
            Reviews, vouches and curation signals are made by your wallet and recorded on the knowledge graph. You are solely responsible for them. They are public and permanent, and only the wallet that made a signal can change or withdraw it, to the extent the protocol allows.
          </Item>
          <Item label="No Central Moderation">
            Nexura does not edit, rank by hand, or remove signals on the knowledge graph. Reputation, including the Nexura Score, is calculated from public graph data using published, rule-based methods.
          </Item>
        </List>
      </Section>

      <Section id="rewards" title="7. Rewards, XP and Nexura Score">
        <List>
          <Item label="XP, Levels and Badges">
            XP, levels, badges and the Nexura Score measure participation and reputation. They have no monetary value, are not currency or property, and cannot be sold, transferred or exchanged for money.
          </Item>
          <Item label="Campaign Rewards">
            Token rewards are offered and funded by the project running a campaign and are paid through smart contracts. Eligibility, amounts and timing are set by the campaign's rules. Nexura does not promise, guarantee or pay any reward.
          </Item>
          <Item label="Claims">
            Rewards may need to be claimed within a set period and may require network fees. Unclaimed or ineligible rewards may be forfeited according to the campaign's rules and the contract's terms.
          </Item>
          <Item label="Taxes">
            You are solely responsible for any taxes that apply to rewards you receive.
          </Item>
        </List>
      </Section>

      <Section id="nexura-studio" title="8. Nexura Studio">
        <p>If you use Nexura Studio, these additional terms apply to you and to the project you represent.</p>
        <List>
          <Item label="Hubs">
            A hub represents your project on Nexura. Information you publish on your hub profile must be accurate and must not impersonate any other person, project or organization.
          </Item>
          <Item label="Team and Governance">
            Hubs are managed by their own team. Important changes, such as adding or removing admins, changing roles, editing or ending live campaigns, are made through proposals signed and approved by the hub's signers. Your team is responsible for choosing its signers and for every proposal it approves and executes. Nexura does not take part in or override a hub's governance.
          </Item>
          <Item label="Campaign Funding">
            When a campaign offers rewards, you fund the reward pool on-chain before it can be published. Funded amounts and reward terms become locked once published, although the pool can be increased. Publishing may require a launch fee, which is non-refundable once a campaign is published.
          </Item>
          <Item label="Your Obligations">
            You are responsible for your campaigns, their tasks and their rewards, for complying with the laws that apply to them, including consumer protection, advertising, promotions, securities and sanctions laws, and for reviewing submissions fairly and on time.
          </Item>
          <Item label="Participant Information">
            You receive participant information, such as wallet addresses, usernames and submissions, only to run your campaigns. You must not sell it, use it for unrelated purposes, or use it to contact participants without their permission.
          </Item>
          <Item label="Integrations">
            If you connect the Nexura Discord bot or other integrations, you authorize them to perform the actions needed to verify campaign tasks.
          </Item>
        </List>
      </Section>

      <Section id="partners" title="9. Partners and Third-Party Projects">
        <p>
          Nexura works with partner projects across the ecosystem, and many campaigns, dapps and links on Nexura are provided by third parties. A partnership or listing exists for discovery and collaboration. It does not mean Nexura endorses, audits, controls or is responsible for a project, its tokens, its smart contracts, or how it handles your information or funds. Your dealings with any project are solely between you and that project. Do your own research before interacting with any third party.
        </p>
      </Section>

      <Section id="acceptable-use" title="10. Acceptable Use">
        <p>You agree not to:</p>
        <List>
          <Item label="Manipulation">
            Use multiple wallets, bots, scripts, farms or automated interactions to inflate participation, reputation or rewards.
          </Item>
          <Item label="Collusion">
            Trade, sell or coordinate vouches, reviews or curation signals, or approve submissions in exchange for anything of value.
          </Item>
          <Item label="False Claims">
            Submit fabricated, copied or misleading proof of action, or misrepresent your identity or affiliation.
          </Item>
          <Item label="Interference">
            Exploit bugs, attack, overload, probe or reverse engineer Nexura or its smart contracts, or bypass any security or access control.
          </Item>
          <Item label="Harmful Content">
            Publish content that is unlawful, infringing, fraudulent, deceptive, hateful, harassing, or that contains malware or phishing links.
          </Item>
          <Item label="Unlawful Use">
            Use Nexura for money laundering, sanctions evasion, unregistered securities offerings, or any other unlawful purpose.
          </Item>
          <Item label="Scraping">
            Collect information about other users from the Nexura interface by automated means, other than by reading public on-chain data.
          </Item>
        </List>
      </Section>

      <Section id="fraud-prevention" title="11. Fraud Prevention">
        <p>
          To protect honest participants and the projects funding campaigns, wallets involved in fraud, manipulation or abuse of these Terms may be blocked from using the Nexura interface and from earning rewards through it. This does not change or remove anything recorded on the knowledge graph, which Nexura does not control.
        </p>
      </Section>

      <Section id="your-content" title="12. Your Content">
        <p>
          You keep ownership of the content you submit, such as profile details, task submissions, hub information and campaign materials. You grant Nexura a worldwide, non-exclusive, royalty-free license to host, display and transmit that content as needed to operate Nexura. You confirm that you have the rights to everything you submit. Content written to the knowledge graph is public by nature and can be read and used by anyone.
        </p>
      </Section>

      <Section id="intellectual-property" title="13. Nexura's Intellectual Property">
        <p>
          The Nexura name, logos, designs, interface and software are owned by Nexura or its licensors. These Terms do not grant you any right to use them, except to use Nexura as intended. Open protocols and open-source components remain subject to their own licenses.
        </p>
      </Section>

      <Section id="blockchain-risks" title="14. Blockchain and Digital Asset Risks">
        <p>By using Nexura, you acknowledge that:</p>
        <List>
          <Item label="Finality">Blockchain transactions and knowledge graph records are public and generally cannot be reversed or deleted.</Item>
          <Item label="Smart Contracts">Smart contracts may contain bugs or be exploited, which can lead to loss of funds or rewards.</Item>
          <Item label="Volatility">The value of digital assets can change rapidly and may fall to zero.</Item>
          <Item label="Networks">Networks may be congested, forked, upgraded or unavailable, and network fees vary.</Item>
          <Item label="Regulation">Laws on digital assets are evolving and may affect your ability to use Nexura or hold rewards.</Item>
        </List>
      </Section>

      <Section id="no-advice" title="15. No Financial Advice">
        <p>
          Nothing on Nexura is financial, investment, legal or tax advice. Campaigns, listings, curation signals, scores and rankings are not recommendations to buy, sell or hold any asset.
        </p>
      </Section>

      <Section id="disclaimers" title="16. Disclaimers">
        <p>
          Nexura is provided "as is" and "as available". To the fullest extent permitted by law, Nexura disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, title and non-infringement. Nexura does not warrant that the service will be uninterrupted, secure or error-free, or that any campaign, project, reward, review, vouch or score is accurate, reliable or lawful.
        </p>
      </Section>

      <Section id="limitation-of-liability" title="17. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Nexura and its contributors, affiliates and partners will not be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of profits, data, digital assets, rewards or goodwill, arising from your use of or inability to use Nexura, from any campaign or third-party project, or from any blockchain or smart contract event. Nexura's total liability for any claim relating to Nexura is limited to the greater of the fees you paid directly to Nexura in the twelve months before the claim and one hundred US dollars. Some jurisdictions do not allow certain limitations, so some of these may not apply to you.
        </p>
      </Section>

      <Section id="indemnity" title="18. Indemnity">
        <p>
          You agree to indemnify and hold harmless Nexura and its contributors, affiliates and partners from any claims, losses and expenses, including reasonable legal fees, arising from your use of Nexura, your content, your campaigns, your breach of these Terms, or your violation of any law or the rights of others.
        </p>
      </Section>

      <Section id="ending-use" title="19. Ending Your Use">
        <p>
          You can stop using Nexura at any time by disconnecting your wallet and signing out. Nexura may suspend or end access to its interface for anyone who breaches these Terms or where required by law. Sections that by their nature should continue, including those on your content, risks, disclaimers, limitation of liability, indemnity and disputes, survive after your use ends.
        </p>
      </Section>

      <Section id="changes-to-terms" title="20. Changes to These Terms">
        <p>
          These Terms may be updated as Nexura evolves. When they are, the date at the top of this page changes and you will be asked to review and agree to the new version before you continue using Nexura. If you do not agree, stop using Nexura.
        </p>
      </Section>

      <Section id="disputes" title="21. Disputes">
        <p>
          If you have a concern, please contact the Nexura team first so we can try to resolve it informally. If a dispute cannot be resolved within 30 days, it will be settled on an individual basis, not as part of a class or representative action, under the laws and in the courts that apply to Nexura's operating entity, unless the law where you live requires otherwise.
        </p>
      </Section>

      <Section id="general" title="22. General">
        <p>
          These Terms and the Privacy Policy are the entire agreement between you and Nexura about Nexura. If any part is found unenforceable, the rest remains in effect. A failure to enforce any part is not a waiver. You may not transfer your rights under these Terms. Nexura may transfer its rights as part of a reorganization, merger or sale.
        </p>
      </Section>

      <h2 id="privacy-policy" className="text-white text-xl font-semibold mt-12 scroll-mt-6">
        Privacy Policy
      </h2>

      <p className="text-gray-400 text-sm mt-4 leading-6">
        This Privacy Policy explains how information is handled when you use the Nexura app and Nexura Studio. It forms part of the{" "}
        <a href={TERMS_URL} className={link}>Terms of Use</a>.
      </p>

      <Section id="privacy-overview" title="How Nexura Handles Information">
        <p>
          Nexura is built on a decentralized knowledge graph. Your contributions, vouches, reviews and curation signals are recorded on that graph under your wallet. They belong to you, live on a public protocol, and can be read directly by you or by any application. Nexura does not own these records and does not keep them on your behalf. Off-chain, Nexura keeps only what it needs to run the app, which is described below. Nexura does not sell information and does not use advertising trackers.
        </p>
      </Section>

      <Section id="knowledge-graph-records" title="Records on the Knowledge Graph">
        <List>
          <Item label="Public by Design">
            Anything written to the knowledge graph, including your wallet address and the contributions and signals linked to it, is public and visible to anyone.
          </Item>
          <Item label="Controlled by Your Wallet">
            Only the wallet that created a record can act on it, and only in the ways the protocol allows. Nexura cannot edit, hide or delete records on the graph.
          </Item>
          <Item label="Portable">
            Because the graph is open, your contribution history goes with your wallet. Any application that reads the graph can see it, and you never need Nexura to access it.
          </Item>
        </List>
      </Section>

      <Section id="information-we-collect" title="Information the App Uses">
        <List>
          <Item label="Wallet">
            Your public wallet address and the message you sign to prove you control it. Private keys and seed phrases are never requested or stored.
          </Item>
          <Item label="Profile">
            Your username, display name and profile picture.
          </Item>
          <Item label="Connected Accounts">
            Your X and Discord username and account ID, when you choose to connect them, so campaign tasks can be verified.
          </Item>
          <Item label="Campaign Activity">
            The campaigns you join, the tasks you complete and the proof of action you submit, so projects can verify them and rewards can be distributed.
          </Item>
          <Item label="Approximate Location">
            When you sign in, your IP address is used to determine your country and continent, which are kept with your account. The IP address itself is kept only briefly in security records used to stop abuse.
          </Item>
          <Item label="Studio Accounts">
            For project teams: email address, password (stored only in hashed form), two-factor authentication settings, hub details, team roles and signed governance actions.
          </Item>
          <Item label="Browser Storage">
            Sign-in tokens and preferences are stored in your browser to keep you signed in. No advertising cookies or third-party analytics trackers are used.
          </Item>
        </List>
      </Section>

      <Section id="how-we-use-information" title="How Information Is Used">
        <List>
          <Item label="Running Nexura">Signing you in, showing your profile and progress, and operating campaigns.</Item>
          <Item label="Verification">Confirming that campaign tasks were completed.</Item>
          <Item label="Reputation">Calculating scores, levels and rankings from your activity and public graph data.</Item>
          <Item label="Safety">Detecting and preventing fraud, abuse and manipulation, including the use of multiple wallets.</Item>
          <Item label="Account Emails">Sending Studio users verification codes, invitations, governance notices and security alerts.</Item>
          <Item label="Statistics">Producing aggregate figures, such as the number of participants by country.</Item>
          <Item label="Legal">Meeting legal obligations.</Item>
        </List>
      </Section>

      <Section id="public-information" title="What Others Can See">
        <List>
          <Item label="Everyone">
            Your username, profile picture, level, XP, badges, Nexura Score and anything recorded on the knowledge graph.
          </Item>
          <Item label="Projects">
            Projects whose campaigns you join can see your wallet address, username, connected account names and the submissions you make to their campaigns.
          </Item>
          <Item label="Other Participants">
            Participants who peer review a task can see the submission they are reviewing.
          </Item>
        </List>
      </Section>

      <Section id="how-we-share-information" title="Sharing">
        <p>Information is never sold. It is shared only as follows:</p>
        <List>
          <Item label="Service Providers">
            Providers that help run Nexura: cloud hosting and databases, image and file storage, email delivery, IP geolocation, blockchain infrastructure such as network nodes and indexers, wallet connection services, and social data services that verify X tasks.
          </Item>
          <Item label="Projects">
            The projects running the campaigns you join, as described above.
          </Item>
          <Item label="Platforms You Connect">
            X and Discord receive information under their own privacy policies when you connect them.
          </Item>
          <Item label="Legal Requirements">
            When required by law, or to protect the rights, property or safety of Nexura, its users or others.
          </Item>
          <Item label="Business Transfers">
            As part of a merger, acquisition or sale of assets involving Nexura.
          </Item>
        </List>
      </Section>

      <Section id="data-retention" title="Retention">
        <p>
          Off-chain information is kept while your account is in use and as needed to run Nexura. Wallet addresses blocked for fraud are kept to enforce the block. Security records used to stop abuse expire automatically. Records on the knowledge graph are permanent by the nature of the protocol and are outside Nexura's control.
        </p>
      </Section>

      <Section id="your-choices" title="Your Control">
        <List>
          <Item label="Profile">Edit your username, display name and picture at any time from your profile.</Item>
          <Item label="Connected Accounts">Disconnect X or Discord at any time from your profile.</Item>
          <Item label="Wallet">Disconnect your wallet and sign out whenever you choose.</Item>
          <Item label="Your Records">Your contributions and signals stay with your wallet on the knowledge graph, where you can view them and act on them directly.</Item>
          <Item label="Studio">Studio team membership is managed by each hub through its own governance.</Item>
        </List>
      </Section>

      <Section id="security" title="Security">
        <p>
          Nexura uses signed wallet sign-in, hashed passwords, two-factor authentication for Studio, signed governance actions and encrypted connections. No system is completely secure, and you are responsible for keeping your wallet and its credentials safe.
        </p>
      </Section>

      <Section id="children" title="Children">
        <p>
          Nexura is not intended for anyone under {MIN_AGE}. Information is not knowingly collected from children. If an account is found to belong to someone under {MIN_AGE}, its off-chain information is removed and the account is closed. If you believe a child has used Nexura, please contact us.
        </p>
      </Section>

      <Section id="international-transfers" title="International Use">
        <p>
          Nexura and its service providers operate in several countries, and off-chain information may be processed outside the country where you live. The knowledge graph is a global network and is accessible from anywhere.
        </p>
      </Section>

      <Section id="policy-changes" title="Changes to This Policy">
        <p>
          When this policy is updated, the date at the top of this page changes and you will be asked to review and agree to the new version before you continue using Nexura.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          Questions about these Terms or this Privacy Policy can be sent to the Nexura team on{" "}
          <a href="https://discord.gg/bADTCtzyb" target="_blank" rel="noopener noreferrer" className={link}>Discord</a> or{" "}
          <a href="https://x.com/NexuraXYZ" target="_blank" rel="noopener noreferrer" className={link}>X</a>.
        </p>
      </Section>

      <div className="mt-10 flex justify-between max-w-[59rem]">

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
