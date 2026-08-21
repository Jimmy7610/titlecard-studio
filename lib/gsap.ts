"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";

/**
 * GSAP is registered once at module scope. Client component modules evaluate a
 * single time per environment, so the plugin registration and the custom eases
 * below are never duplicated — even under React Strict Mode double-invocation,
 * which re-runs effects but not module bodies.
 */
gsap.registerPlugin(useGSAP, CustomEase);

/**
 * Sharp, front-loaded eases. `agentReveal` is the reference curve: it covers
 * ~90% of the distance in the first third of the tween, which is what makes a
 * masked character look like it snaps into place rather than slides.
 */
CustomEase.create("agentReveal", "M0,0 C0.16,1 0.3,1 1,1");
CustomEase.create("agentSweep", "M0,0 C0.7,0 0.14,1 1,1");
CustomEase.create("weightless", "M0,0 C0.05,0.72 0.12,1 1,1");

export { gsap, useGSAP };
