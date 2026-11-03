import { Cousine } from "next/font/google";

const cousine = Cousine({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-cousine" });

export const MONO = `${cousine.style.fontFamily}, ui-monospace, monospace`;
export const cousineVariable = cousine.variable;
