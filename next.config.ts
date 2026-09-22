import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

export default withEve(nextConfig, {
  agents: {
    companion: "./agents/companion",
    tutor: "./agents/tutor",
  },
});
