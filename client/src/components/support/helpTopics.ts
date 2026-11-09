export type HelpArticle = { title: string; intro: string; steps: string[] };
export type HelpTopic = { title: string; articles: HelpArticle[] };

export const APP_HELP: HelpTopic[] = [
  {
    title: "Troubleshooting",
    articles: [
      {
        title: "My wallet won't connect",
        intro: "Nexura works with wallets on the Intuition network.",
        steps: [
          "Unlock your wallet and switch it to Intuition Mainnet.",
          "Refresh the page and press Connect Wallet.",
          "When your wallet asks, sign the \"Nexura Wallet Login\" message. It's free and sends no transaction.",
        ],
      },
      {
        title: "A campaign task won't verify",
        intro: "Tasks that check X or Discord need those accounts linked first.",
        steps: [
          "Open your Profile and press Edit Profile.",
          "Connect X and Discord.",
          "Do the task, wait about a minute, then press Claim on it again.",
        ],
      },
      {
        title: "My XP didn't show up",
        intro: "Campaign XP is added one stage at a time.",
        steps: [
          "A stage pays once every task in it is done.",
          "Some stages open a few days after you join. Their XP is added once they open.",
          "XP History on your Profile lists every reward you've received.",
        ],
      },
    ],
  },
  {
    title: "Using Nexura",
    articles: [
      {
        title: "How daily check-in works",
        intro: "Press Daily Check In at the top of the page once a day to earn 50 XP.",
        steps: [
          "Every day you check in without a break adds 1 to your streak. A new day starts at 12:00 AM UTC.",
          "Streaks earn bonus XP: 500 XP at 7 days, 1,000 at 15, 2,500 at 30, rising to 50,000 at 365.",
          "Miss a day and your streak starts over. You can restore it for 1 TRUST from the check-in window.",
        ],
      },
      {
        title: "How campaigns work",
        intro: "Campaigns are run by projects building on Intuition. Find them under Campaigns or Explore.",
        steps: [
          "Open a campaign and press Join.",
          "Complete the tasks in each stage. Some campaigns open a new stage every few days.",
          "Each finished stage adds its XP to your account. Some campaigns also reward TRUST.",
        ],
      },
      {
        title: "Linking X and Discord",
        intro: "Linking lets Nexura check social tasks for you.",
        steps: [
          "Open your Profile and press Edit Profile.",
          "Press Connect next to X or Discord and approve access.",
          "To unlink, press Disconnect in the same place.",
        ],
      },
    ],
  },
];

export const STUDIO_HELP: HelpTopic[] = [
  {
    title: "Troubleshooting",
    articles: [
      {
        title: "I can't sign in",
        intro: "Each Studio account is locked to one wallet.",
        steps: [
          "Connect the wallet linked to your account. Other wallets aren't let in.",
          "Enter your email and password.",
          "If 2-step verification is on, enter the 6-digit code from your authenticator app.",
        ],
      },
      {
        title: "My campaign won't publish",
        intro: "Publishing needs the launch fee, paid in TRUST.",
        steps: [
          "Pay the fee from the wallet linked to your account. Payments from other wallets aren't accepted.",
          "Each payment covers one launch. Pay again for your next campaign.",
          "Co-hosted campaigns launch once every co-host has paid its share and marked ready.",
        ],
      },
      {
        title: "A Discord task can't be verified",
        intro: "Discord tasks are checked by the Nexura bot inside your server.",
        steps: [
          "Connect your Discord server to your studio.",
          "Make sure the Nexura bot is in the server and can see the channel.",
          "Choose the role or channel the task should check, then save.",
        ],
      },
    ],
  },
  {
    title: "Using Studio",
    articles: [
      {
        title: "Adding or removing admins",
        intro: "Team changes go through proposals, so no single admin can change the team alone.",
        steps: [
          "Create a proposal in Admin Management.",
          "Signers approve or reject it with their wallets.",
          "Once enough signers approve, the change takes effect.",
        ],
      },
      {
        title: "Co-hosting a campaign",
        intro: "Run one campaign together with another studio.",
        steps: [
          "Invite the other studio from the campaign builder.",
          "Each studio builds its own stages.",
          "Each studio pays its share of the launch fee and marks ready. Then the campaign can launch.",
        ],
      },
      {
        title: "Turning on 2-step verification",
        intro: "Adds a code from your phone to every sign-in.",
        steps: [
          "Open Account Settings.",
          "Turn on 2-step verification and scan the QR code with Google Authenticator or a similar app.",
          "Enter the 6-digit code to confirm.",
        ],
      },
    ],
  },
];
