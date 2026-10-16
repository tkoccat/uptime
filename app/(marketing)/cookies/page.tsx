import type { Metadata } from "next";
import { H2, LegalPage, UL } from "@/components/legal/legal-page";
import { CookieSettingsButton } from "@/components/legal/cookie-banner";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy">
      <p>
        Cookies are small files stored on your device. We use them as described below, in line with the Privacy and
        Electronic Communications Regulations (PECR) and UK GDPR.
      </p>

      <H2>Strictly necessary cookies</H2>
      <p>These are always on because the Service cannot work without them and they do not need consent.</p>
      <UL
        items={[
          "Authentication session cookies: keep you signed in securely.",
          "Cookie preference cookie (cookie_consent): remembers your choice below.",
        ]}
      />

      <H2>Analytics and marketing cookies</H2>
      <p>
        Only set if you choose &quot;Accept all&quot;. They help us understand where sign-ups come from and measure our
        advertising.
      </p>
      <UL
        items={[
          "Google Ads / Google tag: conversion measurement.",
          "Meta Pixel: advertising measurement.",
          "Sign-up source (UTM parameters): stored with your account when you consent.",
        ]}
      />

      <H2>Change your choice</H2>
      <p>You can change your choice at any time:</p>
      <CookieSettingsButton />
    </LegalPage>
  );
}
